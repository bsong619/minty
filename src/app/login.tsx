import { useState, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTH_FLOW_KEY } from "./_layout";
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, ActivityIndicator, Animated, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as AppleAuthentication from "expo-apple-authentication";
import { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { C, SHADOW } from "@/lib/theme";

const DOT_COLORS = ["#48E5B0", "#7AAEF0", "#F5C95A"];
const FEATURES = [
  "AI-powered grade prediction",
  "Centering, corners, edges & surface analysis",
  "Tips to improve your card's grade",
];

function InputField({ label, placeholder, value, onChangeText, secureTextEntry, keyboardType, textContentType, autoCapitalize, returnKeyType, onSubmitEditing, inputRef, error }: any) {
  const [hidden, setHidden] = useState(secureTextEntry ?? false);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const onFocus = () => Animated.timing(borderAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  const onBlur = () => Animated.timing(borderAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.red] });
  const bgColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: [C.surface, "#172A1C"] });

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: "500", color: C.textSecondary, letterSpacing: 0.2 }}>{label}</Text>
      <Animated.View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: error ? C.red : borderColor, backgroundColor: bgColor, flexDirection: "row", alignItems: "center", overflow: "hidden" }}>
        <TextInput
          ref={inputRef}
          placeholder={placeholder}
          placeholderTextColor={C.textTertiary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          textContentType={textContentType}
          autoCapitalize={autoCapitalize ?? "none"}
          autoCorrect={false}
          returnKeyType={returnKeyType ?? "next"}
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{ flex: 1, padding: 14, fontSize: 15, color: C.text }}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHidden(!hidden)} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: C.textTertiary }}>{hidden ? "Show" : "Hide"}</Text>
          </Pressable>
        )}
      </Animated.View>
      {error && <Text style={{ fontSize: 12, color: C.red }}>{error}</Text>}
    </View>
  );
}

function validate(mode: "signin" | "signup", email: string, password: string) {
  const errors: Record<string, string> = {};
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!password || password.length < 8) errors.password = "Password must be at least 8 characters.";
  return errors;
}

export default function LoginScreen() {
  const router = useRouter();
  const { refreshAuth } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, []);

  const pressBtnIn = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const pressBtnOut = () => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  const switchMode = (m: "signin" | "signup") => { setMode(m); setErrors({}); };

  const completeFlow = async () => {
    await AsyncStorage.setItem(AUTH_FLOW_KEY, "1");
    router.replace("/(tabs)/(scan)" as any);
  };

  const handleGuest = async () => {
    try {
      await refreshAuth();
      await completeFlow();
    } catch (e: any) {
      console.error("Guest flow failed:", e);
      await completeFlow();
    }
  };

  const handleSubmit = async () => {
    const errs = validate(mode, email, password);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
        await refreshAuth();
        await completeFlow();
      } else {
        const user = await signUpWithEmail(email.trim(), password, firstName.trim() || undefined);
        if (user?.email_confirmed_at || user?.confirmed_at || user?.identities?.length) {
          await refreshAuth();
          await completeFlow();
        } else {
          setSuccess(true);
        }
      }
    } catch (err: any) {
      const msg: string = err.message ?? "Something went wrong.";
      if (msg.toLowerCase().includes("password")) setErrors({ password: msg });
      else if (msg.toLowerCase().includes("email") || msg.toLowerCase().includes("user")) setErrors({ email: msg });
      else setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const userId = await signInWithGoogle();
      if (userId) { await refreshAuth(); await completeFlow(); }
    } catch (err: any) {
      setErrors({ general: err.message ?? "Google sign-in failed." });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleApple = async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        await signInWithApple(credential.identityToken);
        await refreshAuth();
        await completeFlow();
      }
    } catch (err: any) {
      if (err.code !== "ERR_REQUEST_CANCELED") {
        setErrors({ general: err.message ?? "Apple sign-in failed." });
      }
    } finally {
      setAppleLoading(false);
    }
  };

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", padding: 32, gap: 20 }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, borderCurve: "continuous", backgroundColor: C.redFaint, borderWidth: 1, borderColor: C.borderGlow, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 36 }}>📬</Text>
        </View>
        <View style={{ alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: C.text, textAlign: "center", letterSpacing: -0.3 }}>Check your inbox</Text>
          <Text style={{ fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 22 }}>
            We sent a confirmation link to{"\n"}
            <Text style={{ color: C.text, fontWeight: "600" }}>{email}</Text>
          </Text>
          <Text style={{ fontSize: 14, color: C.textTertiary, textAlign: "center", lineHeight: 20, marginTop: 4 }}>
            Click the link to activate your account, then sign in.
          </Text>
        </View>
        <Pressable
          onPress={() => { setSuccess(false); setMode("signin"); }}
          style={({ pressed }) => ({ marginTop: 8, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, borderCurve: "continuous", backgroundColor: C.red, opacity: pressed ? 0.85 : 1, boxShadow: SHADOW.glow } as any)}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: "white" }}>Back to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior="padding">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 60, alignItems: "center" }}
        showsVerticalScrollIndicator={false}
      >
       <View style={{ width: "100%", maxWidth: 520 }}>
        {/* Hero */}
        <View style={{ alignItems: "center", paddingTop: 80, paddingBottom: 32, gap: 12 }}>
          {/* App Logo */}
          <View style={{ width: 64, height: 64, borderRadius: 18, borderCurve: "continuous", overflow: "hidden", marginBottom: 4, boxShadow: SHADOW.card }}>
            <Image source={require("@/assets/icon.png")} style={{ width: 64, height: 64 }} contentFit="cover" />
          </View>
          <Text style={{ fontSize: 34, fontWeight: "900", color: C.text, letterSpacing: -1.2 }}>Minty</Text>
          <Text style={{ fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 22 }}>
            Is your card a 10? Find out before you send it in.
          </Text>
          {/* Feature pills */}
          <View style={{ gap: 8, width: "100%", marginTop: 4 }}>
            {FEATURES.map((text, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 14, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderSubtle }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: DOT_COLORS[i] }} />
                <Text style={{ fontSize: 14, color: C.textSecondary, flex: 1 }}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tab switcher */}
        <View style={{ flexDirection: "row", backgroundColor: C.surface, borderRadius: 12, borderCurve: "continuous", padding: 3, marginBottom: 20, borderWidth: 1, borderColor: C.border }}>
          {(["signin", "signup"] as const).map((m) => (
            <Pressable
              key={m} onPress={() => switchMode(m)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: mode === m ? C.red : "transparent", ...(mode === m ? { boxShadow: "0 2px 8px rgba(0,0,0,0.3)" } : {}) }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: mode === m ? "white" : C.textTertiary }}>
                {m === "signin" ? "Sign In" : "Create Account"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Form */}
        <View style={{ gap: 14 }}>
          {mode === "signup" && (
            <InputField
              label="First name"
              placeholder="Alex"
              value={firstName}
              onChangeText={setFirstName}
              textContentType="givenName"
              autoCapitalize="words"
              returnKeyType="next"
              error={errors.firstName}
            />
          )}
          <InputField
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={errors.email}
          />
          <InputField
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === "signup" ? "newPassword" : "password"}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            inputRef={passwordRef}
            error={errors.password}
          />
          {mode === "signin" && (
            <Pressable onPress={() => router.push("/forgot-password" as any)} style={{ alignSelf: "flex-end", marginTop: -4 }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.red }}>Forgot password?</Text>
            </Pressable>
          )}
        </View>

        {errors.general && (
          <View style={{ marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: "rgba(255,107,107,0.08)", borderWidth: 1, borderColor: "rgba(255,107,107,0.2)" }}>
            <Text style={{ fontSize: 13, color: C.red, textAlign: "center" }}>{errors.general}</Text>
          </View>
        )}

        {/* Primary CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: 20 }}>
          <Pressable
            onPressIn={pressBtnIn} onPressOut={pressBtnOut} onPress={handleSubmit} disabled={loading}
            style={{ paddingVertical: 16, borderRadius: 16, borderCurve: "continuous", alignItems: "center", opacity: loading ? 0.7 : 1, backgroundColor: C.red, boxShadow: SHADOW.glow } as any}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: 0.2 }}>{mode === "signin" ? "Sign In" : "Create Account"}</Text>
            }
          </Pressable>
        </Animated.View>

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: C.borderSubtle }} />
          <Text style={{ fontSize: 12, color: C.textDisabled, fontWeight: "500" }}>or continue with</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: C.borderSubtle }} />
        </View>

        {/* Social buttons */}
        <View style={{ gap: 10 }}>
          {/* Apple Sign In — required by App Store if any social login is offered */}
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={{ height: 50, width: "100%" }}
              onPress={handleApple}
            />
          )}

          {/* Google */}
          <Pressable
            onPress={handleGoogle}
            disabled={googleLoading}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
              paddingVertical: 14, borderRadius: 12, borderCurve: "continuous",
              borderWidth: 1.5, borderColor: C.border,
              backgroundColor: pressed ? C.surfaceHover : C.surface,
              opacity: googleLoading ? 0.7 : 1,
            })}
          >
            {googleLoading ? <ActivityIndicator color={C.textSecondary} size="small" /> : (
              <>
                <View style={{ flexDirection: "row", gap: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#4285F4" }}>G</Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#EA4335" }}>o</Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#FBBC05" }}>o</Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#4285F4" }}>g</Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#34A853" }}>l</Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#EA4335" }}>e</Text>
                </View>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: "500" }}>Sign in with Google</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <View style={{ alignItems: "center", gap: 10, marginTop: 24 }}>
          <Pressable onPress={handleGuest} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 13, color: C.textTertiary }}>Continue as Guest</Text>
          </Pressable>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4, alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: C.textDisabled }}>By continuing, you agree to our</Text>
            <Pressable onPress={() => router.push("/terms" as any)}>
              <Text style={{ fontSize: 11, color: C.textTertiary, fontWeight: "600" }}>Terms</Text>
            </Pressable>
            <Text style={{ fontSize: 11, color: C.textDisabled }}>and</Text>
            <Pressable onPress={() => router.push("/privacy" as any)}>
              <Text style={{ fontSize: 11, color: C.textTertiary, fontWeight: "600" }}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
       </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
