import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import DocumentScanner, { ResponseType, ScanDocumentResponseStatus } from "react-native-document-scanner-plugin";
import { setPendingImageUri, setPendingImageUris } from "@/lib/pending-scan";
import { C, FONT } from "@/lib/theme";
import { Icon } from "@/components/icon";

// VNDocumentCameraViewController on iOS / ML Kit Document Scanner on Android.
// Both ship with auto-capture (rectangle detection + focus quality), perspective
// correction, and multi-page support — same engine Apple Notes uses for scanning
// documents. We hand it 'maxNumDocuments: 2' so users can capture front + back
// in a single session without leaving the scanner UI.

export default function CameraScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const launchedRef = useRef(false);

  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    (async () => {
      try {
        const result = await DocumentScanner.scanDocument({
          croppedImageQuality: 100,
          maxNumDocuments: 2,
          responseType: ResponseType.ImageFilePath,
        });
        if (result.status === ScanDocumentResponseStatus.Cancel) {
          router.back();
          return;
        }
        const imgs = result.scannedImages ?? [];
        if (imgs.length === 0) {
          router.back();
          return;
        }
        if (imgs.length === 1) {
          setPendingImageUri(imgs[0]);
        } else {
          // First captured = front, second = back. The system scanner doesn't
          // know front from back, so we rely on user capture order.
          setPendingImageUris(imgs[0], imgs[1]);
        }
        router.replace("/(tabs)/(scan)/analyzing");
      } catch (e: any) {
        console.error("DocumentScanner error:", e);
        const msg = e?.message ?? "Couldn't open the scanner.";
        // Camera-permission denial surfaces here on iOS. Recognize the common
        // strings so we can route the user to Settings instead of a dead error.
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("authorized")) {
          setError("permission");
        } else {
          setError(msg);
        }
      }
    })();
  }, [router]);

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
          style={({ pressed }) => ({
            paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
            backgroundColor: C.mint, opacity: pressed ? 0.85 : 1,
          })}
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

  // While the native scanner is launching, show a black background — the
  // VNDocumentCameraViewController will present itself on top within ~200 ms.
  return <View style={{ flex: 1, backgroundColor: "#000" }} />;
}

// Silence platform-specific unused warning on Android-only builds
void Platform;
