import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, useWindowDimensions, Linking } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useRouter } from "expo-router";
import { setPendingImageUri, setPendingImageUris } from "@/lib/pending-scan";
import { C, FONT } from "@/lib/theme";
import { Icon } from "@/components/icon";

// Try to load the iOS VNDocumentCameraViewController plugin. It's added in
// build 53. Earlier binaries (build 52 and below) won't have the native
// module — `require` will throw, and we fall back to the expo-camera UI.
let DocumentScanner: any = null;
let DocumentScannerResponseType: any = null;
let DocumentScannerStatus: any = null;
try {
  const mod = require("react-native-document-scanner-plugin");
  DocumentScanner = mod.default ?? mod;
  DocumentScannerResponseType = mod.ResponseType;
  DocumentScannerStatus = mod.ScanDocumentResponseStatus;
} catch {
  // Native module not in this binary — fallback path below handles it.
}

const CARD_RATIO = 7 / 5; // height / width (portrait card)
const CARD_WIDTH_RATIO = 5 / 7;
const CORNER_SIZE = 30;
const CORNER_THICKNESS = 3;

async function cropToCardArea(uri: string, w?: number, h?: number): Promise<string> {
  if (!w || !h) return uri;
  try {
    let cropW: number, cropH: number;
    const photoRatio = w / h;
    if (photoRatio < CARD_WIDTH_RATIO) {
      cropW = w * 0.96;
      cropH = cropW / CARD_WIDTH_RATIO;
    } else {
      cropH = h * 0.96;
      cropW = cropH * CARD_WIDTH_RATIO;
    }
    const originX = Math.round((w - cropW) / 2);
    const originY = Math.round((h - cropH) / 2);
    const ref = await ImageManipulator.manipulate(uri)
      .crop({ originX, originY, width: Math.round(cropW), height: Math.round(cropH) })
      .renderAsync();
    const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
    return result.uri;
  } catch (e) {
    console.warn("[cropToCardArea] failed, using uncropped photo:", e);
    return uri;
  }
}

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const top = position.startsWith("t");
  const left = position.endsWith("l");
  return (
    <View style={{ position: "absolute", width: CORNER_SIZE, height: CORNER_SIZE,
      top: top ? 0 : undefined, bottom: top ? undefined : 0,
      left: left ? 0 : undefined, right: left ? undefined : 0,
    }}>
      <View style={{
        position: "absolute", width: CORNER_SIZE, height: CORNER_THICKNESS,
        backgroundColor: "white",
        top: top ? 0 : undefined, bottom: top ? undefined : 0,
        left: left ? 0 : undefined, right: left ? undefined : 0,
      }} />
      <View style={{
        position: "absolute", width: CORNER_THICKNESS, height: CORNER_SIZE,
        backgroundColor: "white",
        top: top ? 0 : undefined, bottom: top ? undefined : 0,
        left: left ? 0 : undefined, right: left ? undefined : 0,
      }} />
    </View>
  );
}

type Phase = "front" | "flip-prompt" | "back";

export default function CameraScreen() {
  const router = useRouter();
  // Use native scanner if available; otherwise fall back to custom CameraView.
  if (DocumentScanner) return <NativeScannerScreen />;
  return <FallbackCameraScreen />;
}

// Native (VisionKit) scanner flow with explicit front/back guidance.
// We invoke the scanner twice — once for the front, once for the back —
// with our own prompt screens between, because VNDocumentCameraViewController
// has no concept of labeled steps. Better UX than one bulk session.
type NativePhase = "intro-front" | "scanning" | "flip-prompt";

function NativeScannerScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<NativePhase>("intro-front");
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<"front" | "back" | null>(null);

  const launchScanner = async (which: "front" | "back") => {
    if (inFlightRef.current) return;
    inFlightRef.current = which;
    setPhase("scanning");
    try {
      const result = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 1,
        responseType: DocumentScannerResponseType?.ImageFilePath ?? "imageFilePath",
      });
      const cancelled = result.status === (DocumentScannerStatus?.Cancel ?? "cancel");
      const imgs = result.scannedImages ?? [];
      if (cancelled || imgs.length === 0) {
        // User backed out of the scanner — return to the prompt for this
        // step instead of leaving the screen, so they can try again.
        inFlightRef.current = null;
        setPhase(which === "front" ? "intro-front" : "flip-prompt");
        return;
      }
      const uri = imgs[0];
      inFlightRef.current = null;
      if (which === "front") {
        setFrontUri(uri);
        setPhase("flip-prompt");
      } else {
        if (!frontUri) {
          // Shouldn't happen, but guard against losing the front photo.
          setPendingImageUri(uri);
        } else {
          setPendingImageUris(frontUri, uri);
        }
        router.replace("/(tabs)/(scan)/analyzing");
      }
    } catch (e: any) {
      console.error("DocumentScanner error:", e);
      inFlightRef.current = null;
      const msg = (e?.message ?? "").toLowerCase();
      if (msg.includes("permission") || msg.includes("denied") || msg.includes("authorized")) {
        setError("permission");
      } else {
        setError(e?.message ?? "Couldn't open the scanner.");
      }
    }
  };

  const skipBack = () => {
    if (!frontUri) return;
    setPendingImageUri(frontUri);
    router.replace("/(tabs)/(scan)/analyzing");
  };

  if (error === "permission") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", gap: 16, padding: 32 }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.surface, justifyContent: "center", alignItems: "center" }}>
          <Icon name="camera" size={24} color={C.mint} strokeWidth={1.8} />
        </View>
        <Text style={{ fontSize: 18, fontFamily: FONT.uiBold, color: C.text, textAlign: "center" }}>Camera access is off</Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20, maxWidth: 300 }}>
          Minty uses your camera to photograph trading cards for grading. Turn on camera access in Settings.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => ({ paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: C.mint, opacity: pressed ? 0.85 : 1 })}
        >
          <Text style={{ fontSize: 15, fontFamily: FONT.uiBold, color: C.onMint, paddingRight: 2 }}>Open Settings</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ fontSize: 14, color: C.textSecondary, paddingVertical: 8 }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", gap: 16, padding: 32 }}>
        <Text style={{ fontSize: 16, color: C.text, textAlign: "center" }}>Couldn&apos;t open the scanner.</Text>
        <Text style={{ fontSize: 12, color: C.textTertiary, textAlign: "center" }}>{error}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: C.mint, paddingVertical: 8 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "scanning") {
    // VisionKit is presenting its own modal on top of us. Black backdrop
    // matches the scanner's appearance so the transition feels seamless.
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  if (phase === "flip-prompt") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 32, gap: 18 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ position: "absolute", top: 56, left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" }}
        >
          <Icon name="close" size={18} color={C.text} />
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.mint }} />
          <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: C.textTertiary, letterSpacing: 1.5 }}>STEP 2 OF 2</Text>
        </View>
        <Text style={{ fontFamily: FONT.display, fontSize: 32, color: C.text, textAlign: "center", lineHeight: 38, letterSpacing: -0.5 }}>
          Now flip the card{"\n"}for the back
        </Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20, maxWidth: 320 }}>
          A photo of the back helps catch edge whitening and centering issues graders look for.
        </Text>
        <Pressable
          onPress={() => launchScanner("back")}
          style={({ pressed }) => ({
            marginTop: 12, paddingVertical: 16, paddingHorizontal: 28, borderRadius: 14, backgroundColor: C.mint,
            opacity: pressed ? 0.85 : 1,
            flexDirection: "row", alignItems: "center", gap: 10,
          })}
        >
          <Icon name="camera" size={16} color={C.onMint} strokeWidth={2.5} />
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 15, color: C.onMint, paddingRight: 2 }}>Take back photo</Text>
        </Pressable>
        <Pressable onPress={skipBack} hitSlop={8}>
          <Text style={{ fontSize: 13, color: C.textTertiary, paddingVertical: 10 }}>Skip — grade with front only</Text>
        </Pressable>
      </View>
    );
  }

  // phase === "intro-front"
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 32, gap: 18 }}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={{ position: "absolute", top: 56, left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" }}
      >
        <Icon name="close" size={18} color={C.text} />
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.mint }} />
        <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: C.textTertiary, letterSpacing: 1.5 }}>STEP 1 OF 2</Text>
      </View>
      <Text style={{ fontFamily: FONT.display, fontSize: 32, color: C.text, textAlign: "center", lineHeight: 38, letterSpacing: -0.5 }}>
        Take a photo{"\n"}of the front
      </Text>
      <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20, maxWidth: 320 }}>
        Place the card on a dark, flat surface. We&apos;ll auto-detect the edges and crop it for you.
      </Text>
      <Pressable
        onPress={() => launchScanner("front")}
        style={({ pressed }) => ({
          marginTop: 12, paddingVertical: 16, paddingHorizontal: 28, borderRadius: 14, backgroundColor: C.mint,
          opacity: pressed ? 0.85 : 1,
          flexDirection: "row", alignItems: "center", gap: 10,
        })}
      >
        <Icon name="camera" size={16} color={C.onMint} strokeWidth={2.5} />
        <Text style={{ fontFamily: FONT.uiBold, fontSize: 15, color: C.onMint, paddingRight: 2 }}>Open camera</Text>
      </Pressable>
    </View>
  );
}

function FallbackCameraScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [phase, setPhase] = useState<Phase>("front");
  const [frontUri, setFrontUri] = useState<string | null>(null);

  const cutoutWidth = Math.min(screenWidth * 0.92, (screenHeight - 240) / CARD_RATIO);
  const cutoutHeight = cutoutWidth * CARD_RATIO;
  const cutoutTop = (screenHeight - cutoutHeight) / 2;
  const cutoutLeft = (screenWidth - cutoutWidth) / 2;

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        const cropped = await cropToCardArea(photo.uri, photo.width, photo.height);
        if (phase === "front") {
          setFrontUri(cropped);
          setPhase("flip-prompt");
        } else {
          setPendingImageUris(frontUri!, cropped);
          router.push("/(tabs)/(scan)/analyzing");
        }
      }
    } catch (e) {
      console.error("Capture error:", e);
    } finally {
      setCapturing(false);
    }
  };

  const skipBack = () => {
    setPendingImageUri(frontUri!);
    router.push("/(tabs)/(scan)/analyzing");
  };

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission?.granted, permission?.canAskAgain]);

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    if (permission.canAskAgain) {
      return <View style={{ flex: 1, backgroundColor: "#000" }} />;
    }
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", gap: 16, padding: 32 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: C.text, textAlign: "center" }}>Camera access is off</Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20 }}>
          Minty uses your camera to photograph trading cards for grading. You can turn on camera access in Settings.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => ({ paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: C.red, opacity: pressed ? 0.85 : 1 })}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>Open Settings</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: C.textSecondary }}>Close</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "flip-prompt") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 32, gap: 20 }}>
        <Text style={{ fontFamily: FONT.display, fontSize: 28, color: C.text, textAlign: "center", lineHeight: 34 }}>Flip the card{"\n"}for the back</Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", maxWidth: 300 }}>
          A photo of the back catches edge whitening and centering issues PSA looks for.
        </Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          <Pressable
            onPress={skipBack}
            style={({ pressed }) => ({ paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ fontSize: 14, color: C.textSecondary }}>Skip</Text>
          </Pressable>
          <Pressable
            onPress={() => setPhase("back")}
            style={({ pressed }) => ({ paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: C.mint, opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.onMint, paddingRight: 2 }}>Take back photo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      {/* Cutout overlay */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: cutoutTop, backgroundColor: "rgba(0,0,0,0.6)" }} />
      <View pointerEvents="none" style={{ position: "absolute", bottom: 0, left: 0, right: 0, top: cutoutTop + cutoutHeight, backgroundColor: "rgba(0,0,0,0.6)" }} />
      <View pointerEvents="none" style={{ position: "absolute", top: cutoutTop, left: 0, width: cutoutLeft, height: cutoutHeight, backgroundColor: "rgba(0,0,0,0.6)" }} />
      <View pointerEvents="none" style={{ position: "absolute", top: cutoutTop, right: 0, left: cutoutLeft + cutoutWidth, height: cutoutHeight, backgroundColor: "rgba(0,0,0,0.6)" }} />
      <View pointerEvents="none" style={{ position: "absolute", top: cutoutTop, left: cutoutLeft, width: cutoutWidth, height: cutoutHeight }}>
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />
      </View>
      <Text style={{ position: "absolute", top: cutoutTop - 36, left: 0, right: 0, textAlign: "center", color: "white", fontSize: 14, fontFamily: FONT.uiBold, opacity: 0.9 }}>
        {phase === "back" ? "Flip card — align the back in the frame" : "Align your card within the frame"}
      </Text>
      {/* Capture button */}
      <View style={{ position: "absolute", bottom: 64, left: 0, right: 0, alignItems: "center" }}>
        <Pressable onPress={handleCapture} disabled={capturing}>
          <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: "white", justifyContent: "center", alignItems: "center", opacity: capturing ? 0.5 : 1 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: "white" }} />
          </View>
        </Pressable>
      </View>
      {/* Close button */}
      <Pressable
        onPress={() => router.back()}
        style={{ position: "absolute", top: 56, left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}
        hitSlop={12}
      >
        <Icon name="close" size={18} color="white" />
      </Pressable>
    </View>
  );
}
