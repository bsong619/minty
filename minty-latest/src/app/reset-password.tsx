import { useState, useRef } from "react";
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  ScrollView, Animated, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { updatePassword } from "@/lib/supabase";
import { C, SHADOW } from "@/lib/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const confirmRef = useRef<TextInput>(null);
  const btnScale = useRef(new Animated.Value(1)).current;

  const handleSubmit = async () => {
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setError("");
    setLoading(true);
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 32, gap: 20 }}>
        <View style={{ width: 72, height: 72, borderRadius: 18, borderCurve: "continuous", backgroundColor: C.redFaint, borderWidth: 1, borderColor: C.borderGlow, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 36 }}>✅</Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: "700", color: C.text, textAlign: "center" }}>Password updated</Text>
        <Text style={{ fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 22 }}>
          Your password has been changed. Sign in with your new password.
        </Text>
        <Pressable
          onPress={() => router.replace("/login")}
          style={{ marginTop: 8, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, borderCurve: "continuous", backgroundColor: C.red, boxShadow: SHADOW.glow } as any}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: "white" }}>Go to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior="padding">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 }}
      >
        <View pointerEvents="none" style={{ position: "absolute", top: -60, left: "50%", marginLeft: -150, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(255,68,68,0.04)" }} />

        <View style={{ marginTop: 80, gap: 8, marginBottom: 32 }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: C.text, letterSpacing: -0.5 }}>Set new password</Text>
          <Text style={{ fontSize: 15, color: C.textSecondary, lineHeight: 22 }}>
            Choose a strong password for your Minty account.
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          {/* Password */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: C.textSecondary, letterSpacing: 0.2 }}>New Password</Text>
            <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", overflow: "hidden" }}>
              <TextInput
                placeholder="Min. 8 characters"
                placeholderTextColor={C.textTertiary}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(""); }}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                style={{ flex: 1, padding: 14, fontSize: 15, color: C.text }}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: C.textTertiary }}>{showPassword ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>
          </View>

          {/* Confirm */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: C.textSecondary, letterSpacing: 0.2 }}>Confirm Password</Text>
            <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: error ? C.red : C.border, backgroundColor: C.surface, overflow: "hidden" }}>
              <TextInput
                ref={confirmRef}
                placeholder="Re-enter password"
                placeholderTextColor={C.textTertiary}
                value={confirm}
                onChangeText={(t) => { setConfirm(t); setError(""); }}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                style={{ padding: 14, fontSize: 15, color: C.text }}
              />
            </View>
            {error ? <Text style={{ fontSize: 12, color: C.red }}>{error}</Text> : null}
          </View>

          <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: 8 }}>
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={{ paddingVertical: 15, borderRadius: 14, borderCurve: "continuous", backgroundColor: C.red, alignItems: "center", opacity: loading ? 0.7 : 1, boxShadow: SHADOW.glow } as any}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>Update Password</Text>
              }
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
