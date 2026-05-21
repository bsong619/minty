import { useState, useRef } from "react";
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  ScrollView, Animated, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { resetPasswordForEmail } from "@/lib/supabase";
import { ResponsiveContainer } from "@/components/responsive-container";
import { C, SHADOW } from "@/lib/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };
  const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.red] });

  const handleSubmit = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    try {
      await resetPasswordForEmail(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior="padding">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 }}
      >
        <View pointerEvents="none" style={{ position: "absolute", top: -60, left: "50%", marginLeft: -150, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(255,68,68,0.04)" }} />

        <ResponsiveContainer>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={{ marginTop: 56, marginBottom: 32, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 18, color: C.red, lineHeight: 22 }}>‹</Text>
          <Text style={{ fontSize: 16, color: C.red, fontWeight: "500" }}>Back</Text>
        </Pressable>

        {sent ? (
          <View style={{ flex: 1, alignItems: "center", gap: 16, paddingTop: 40 }}>
            <View style={{ width: 72, height: 72, borderRadius: 18, borderCurve: "continuous", backgroundColor: C.redFaint, borderWidth: 1, borderColor: C.borderGlow, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 36 }}>📬</Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: "700", color: C.text, textAlign: "center" }}>Check your email</Text>
            <Text style={{ fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 22 }}>
              We sent a password reset link to{"\n"}
              <Text style={{ color: C.text, fontWeight: "600" }}>{email}</Text>
            </Text>
            <Text style={{ fontSize: 13, color: C.textTertiary, textAlign: "center", lineHeight: 20, marginTop: 8 }}>
              Didn't get it? Check your spam folder or try again.
            </Text>
            <Pressable
              onPress={() => setSent(false)}
              style={{ marginTop: 8, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1.5, borderColor: C.border }}
            >
              <Text style={{ fontSize: 15, color: C.textSecondary, fontWeight: "500" }}>Try a different email</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 15, color: C.red, fontWeight: "600" }}>Back to Sign In</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 28, fontWeight: "700", color: C.text, letterSpacing: -0.5 }}>Forgot password?</Text>
              <Text style={{ fontSize: 15, color: C.textSecondary, lineHeight: 22 }}>
                Enter your email and we'll send you a link to reset your password.
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.textSecondary, letterSpacing: 0.2 }}>Email</Text>
              <Animated.View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: error ? C.red : borderColor, backgroundColor: C.surface, overflow: "hidden" }}>
                <TextInput
                  placeholder="you@example.com"
                  placeholderTextColor={C.textTertiary}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(""); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  style={{ padding: 14, fontSize: 15, color: C.text }}
                />
              </Animated.View>
              {error ? <Text style={{ fontSize: 12, color: C.red }}>{error}</Text> : null}
            </View>

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={{ paddingVertical: 15, borderRadius: 14, borderCurve: "continuous", backgroundColor: C.red, alignItems: "center", opacity: loading ? 0.7 : 1, boxShadow: SHADOW.glow } as any}
              >
                {loading
                  ? <ActivityIndicator color="white" />
                  : <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>Send Reset Link</Text>
                }
              </Pressable>
            </Animated.View>
          </View>
        )}
        </ResponsiveContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
