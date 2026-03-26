import { useRef, useState } from "react";
import { View, Text, Pressable, useWindowDimensions, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { setPendingImageUri, setPendingImageUris } from "@/lib/pending-scan";
import { C } from "@/lib/theme";

const CARD_RATIO = 7 / 5; // height / width (portrait card)
const CORNER_SIZE = 30;
const CORNER_THICKNESS = 3;

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const top = position.startsWith("t");
  const left = position.endsWith("l");
  return (
    <View style={{ position: "absolute", width: CORNER_SIZE, height: CORNER_SIZE,
      top: top ? 0 : undefined, bottom: top ? undefined : 0,
      left: left ? 0 : undefined, right: left ? undefined : 0,
    }}>
      {/* Horizontal arm */}
      <View style={{
        position: "absolute",
        width: CORNER_SIZE, height: CORNER_THICKNESS,
        backgroundColor: "white",
        top: top ? 0 : undefined, bottom: top ? undefined : 0,
        left: left ? 0 : undefined, right: left ? undefined : 0,
      }} />
      {/* Vertical arm */}
      <View style={{
        position: "absolute",
        width: CORNER_THICKNESS, height: CORNER_SIZE,
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [phase, setPhase] = useState<Phase>("front");
  const [frontUri, setFrontUri] = useState<string | null>(null);

  const cutoutWidth = screenWidth * 0.8;
  const cutoutHeight = cutoutWidth * CARD_RATIO;
  const cutoutTop = (screenHeight - cutoutHeight) / 2;
  const cutoutLeft = (screenWidth - cutoutWidth) / 2;

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        if (phase === "front") {
          setFrontUri(photo.uri);
          setPhase("flip-prompt");
        } else {
          // back captured — navigate with both
          setPendingImageUris(frontUri!, photo.uri);
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

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", gap: 16, padding: 32 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: C.text, textAlign: "center" }}>Camera Access Required</Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20 }}>
          Minty needs camera access to photograph your cards for grading.
        </Text>
        <Pressable
          onPress={async () => {
            const result = await requestPermission();
            if (!result.granted && !result.canAskAgain) {
              Alert.alert("Camera Permission", "Please enable camera access in Settings > Minty > Camera.");
            }
          }}
          style={({ pressed }) => ({
            paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
            backgroundColor: C.red, opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>Continue</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: C.textSecondary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      {/* Overlay — top */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: cutoutTop, backgroundColor: "rgba(0,0,0,0.6)" }} />
      {/* Overlay — bottom */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, top: cutoutTop + cutoutHeight, backgroundColor: "rgba(0,0,0,0.6)" }} />
      {/* Overlay — left */}
      <View style={{ position: "absolute", top: cutoutTop, left: 0, width: cutoutLeft, height: cutoutHeight, backgroundColor: "rgba(0,0,0,0.6)" }} />
      {/* Overlay — right */}
      <View style={{ position: "absolute", top: cutoutTop, right: 0, left: cutoutLeft + cutoutWidth, height: cutoutHeight, backgroundColor: "rgba(0,0,0,0.6)" }} />

      {/* Corner brackets */}
      <View style={{ position: "absolute", top: cutoutTop, left: cutoutLeft, width: cutoutWidth, height: cutoutHeight }}>
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />
      </View>

      {/* Instruction text above cutout */}
      <View style={{ position: "absolute", top: cutoutTop - 44, left: 0, right: 0, alignItems: "center" }}>
        <Text style={{ color: "white", fontSize: 15, fontWeight: "600" }}>
          {phase === "back" ? "Flip card — align the back in the frame" : "Align your card within the frame"}
        </Text>
      </View>

      {/* Instruction text below cutout */}
      <View style={{ position: "absolute", top: cutoutTop + cutoutHeight + 14, left: 0, right: 0, alignItems: "center" }}>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>Hold steady • Avoid glare</Text>
      </View>

      {/* Capture button */}
      <View style={{ position: "absolute", bottom: 60, left: 0, right: 0, alignItems: "center" }}>
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
      >
        <Text style={{ color: "white", fontSize: 18, lineHeight: 22 }}>✕</Text>
      </Pressable>

      {/* Phase indicator pill (back mode) */}
      {phase === "back" && (
        <View style={{ position: "absolute", top: 56, right: 20 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
            <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>BACK</Text>
          </View>
        </View>
      )}

      {/* Flip prompt overlay */}
      {phase === "flip-prompt" && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 32, gap: 32 }}>
          {/* Card flip icon */}
          <View style={{ alignItems: "center", gap: 0 }}>
            <View style={{ width: 80, height: 112, borderRadius: 10, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 2, borderColor: "#3DD68C", justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 36 }}>✓</Text>
            </View>
            <View style={{ marginTop: -8, width: 80, height: 112, borderRadius: 10, borderCurve: "continuous", backgroundColor: "#1A2E1A", borderWidth: 2, borderColor: "#3DD68C", justifyContent: "center", alignItems: "center", transform: [{ rotate: "6deg" }] }}>
              <Text style={{ fontSize: 28, opacity: 0.6 }}>↩</Text>
            </View>
          </View>

          <View style={{ alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: C.text, letterSpacing: -0.5 }}>Front captured!</Text>
            <Text style={{ fontSize: 16, color: C.textSecondary, textAlign: "center", lineHeight: 24 }}>
              Flip your card over to photograph the back for more accurate centering analysis.
            </Text>
          </View>

          <View style={{ width: "100%", gap: 12 }}>
            <Pressable
              onPress={() => setPhase("back")}
              style={({ pressed }) => ({
                padding: 17, borderRadius: 16, borderCurve: "continuous",
                backgroundColor: C.red, alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "white" }}>Photograph Back</Text>
            </Pressable>
            <Pressable
              onPress={skipBack}
              style={({ pressed }) => ({
                padding: 17, borderRadius: 16, borderCurve: "continuous",
                backgroundColor: C.surface, alignItems: "center",
                borderWidth: 1, borderColor: C.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: C.textSecondary }}>Skip — Front Only</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
