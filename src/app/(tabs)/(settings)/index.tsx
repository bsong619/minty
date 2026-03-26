import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useRouter, router as rootRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/components/auth-provider";
import { AUTH_FLOW_KEY } from "@/app/_layout";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";

function Row({ icon, label, value, onPress, destructive }: { icon: string; label: string; value?: string; onPress?: () => void; destructive?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, opacity: pressed && onPress ? 0.7 : 1 })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 11, borderCurve: "continuous", backgroundColor: destructive ? "rgba(255,107,107,0.08)" : C.white04, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={{ fontSize: 15, color: destructive ? "#FF3B30" : C.text, flex: 1 }}>{label}</Text>
      {value && <Text style={{ fontSize: 14, color: C.textSecondary }}>{value}</Text>}
      {onPress && !destructive && (
        <Text style={{ fontSize: 18, color: C.textDisabled }}>›</Text>
      )}
    </Pressable>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.borderSubtle, marginLeft: 60 }} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, marginLeft: 4 }}>{title}</Text>
      <View style={{ borderRadius: 18, borderCurve: "continuous", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { userEmail, isAnonymous, signOut, userId } = useAuth();

  const handleClearData = () => {
    Alert.alert("Clear All Data", "This permanently deletes all your scanned cards. Cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All Data", style: "destructive", onPress: async () => {
        await AsyncStorage.clear();
        Alert.alert("Done", "All data has been cleared.");
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and all associated data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            try {
              if (userId && supabase) {
                await supabase.rpc("delete_user_account");
              }
              await AsyncStorage.clear();
              signOut().catch(() => {});
              rootRouter.replace("/login" as any);
            } catch (err: any) {
              Alert.alert("Error", err.message ?? "Failed to delete account. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 100, paddingTop: 8 }}
    >
      {/* Account */}
      <Section title="Account">
        <Row icon="👤" label={isAnonymous ? "Guest" : (userEmail ?? "Signed In")} />
        <Divider />
        <Row icon="🚪" label="Sign Out" onPress={() => {
          AsyncStorage.removeItem(AUTH_FLOW_KEY).catch(() => {});
          signOut().catch(() => {});
          rootRouter.replace("/login" as any);
        }} destructive />
      </Section>

      {/* General */}
      <Section title="General">
        <Row icon="📋" label="How to Get the Best Grade" onPress={() => AsyncStorage.removeItem("minty_onboarding_seen").then(() => router.push("/onboarding" as any))} />
        <Divider />
        <Row icon="ℹ️" label="App Version" value="1.0.0" />
      </Section>

      {/* Legal */}
      <Section title="Legal">
        <Row icon="🔒" label="Privacy Policy" onPress={() => router.push("/privacy" as any)} />
        <Divider />
        <Row icon="📄" label="Terms of Service" onPress={() => router.push("/terms" as any)} />
      </Section>

      {/* Data */}
      <Section title="Data">
        <Row icon="🗑️" label="Clear All Data" onPress={handleClearData} destructive />
        <Divider />
        <Row icon="⚠️" label="Delete Account" onPress={handleDeleteAccount} destructive />
      </Section>

      <Text style={{ fontSize: 12, color: C.textDisabled, textAlign: "center", lineHeight: 18 }}>
        Minty is not affiliated with PSA.{"\n"}Grade predictions are estimates only.
      </Text>
    </ScrollView>
  );
}
