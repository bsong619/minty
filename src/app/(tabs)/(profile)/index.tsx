import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, router as rootRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/components/auth-provider";
import { AUTH_FLOW_KEY } from "@/app/_layout";
import { supabase } from "@/lib/supabase";
import { getScannedCards, deleteAllScannedCards } from "@/lib/card-service";
import { getCards } from "@/lib/storage";
import { GradedCard } from "@/lib/types";
import { Icon, type IconName } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";
import { getQuota, FREE_DAILY_LIMIT, type QuotaSnapshot } from "@/lib/scan-quota";

function Row({ icon, label, value, onPress, destructive }: { icon: IconName; label: string; value?: string; onPress?: () => void; destructive?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, opacity: pressed && onPress ? 0.7 : 1 })}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: destructive ? "rgba(216,117,96,0.10)" : C.white04,
        justifyContent: "center", alignItems: "center",
      }}>
        <Icon name={icon} size={16} color={destructive ? C.danger : C.text} />
      </View>
      <Text style={{ fontSize: 14, color: destructive ? C.danger : C.text, flex: 1, fontFamily: FONT.ui }}>{label}</Text>
      {value && <Text style={{ fontSize: 13, color: C.textSecondary }}>{value}</Text>}
      {onPress && !destructive && <Icon name="chevR" size={18} color={C.textTertiary} />}
    </Pressable>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.borderSubtle, marginLeft: 60 }} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: FONT.monoBold, fontSize: 11, color: C.textTertiary, letterSpacing: 1, marginLeft: 4 }}>{title}</Text>
      <View style={{ borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userEmail, isAnonymous, signOut, userId, firstName } = useAuth();
  const [stats, setStats] = useState({ scans: 0, gems: 0, avg: 0 });
  const [quota, setQuota] = useState<QuotaSnapshot>({ used: 0, limit: FREE_DAILY_LIMIT, remaining: FREE_DAILY_LIMIT, isPro: false });

  useFocusEffect(
    useCallback(() => {
      getQuota().then(setQuota);
    }, [])
  );

  useEffect(() => {
    (async () => {
      try {
        const cards: GradedCard[] = userId ? await getScannedCards(userId) : await getCards();
        const scans = cards.length;
        const gems = cards.filter((c) => c.result.overallGrade >= 9.5).length;
        const avg = scans > 0 ? cards.reduce((s, c) => s + c.result.overallGrade, 0) / scans : 0;
        setStats({ scans, gems, avg: Math.round(avg * 10) / 10 });
      } catch {}
    })();
  }, [userId]);

  const handleClearData = () => {
    Alert.alert("Clear all data", "This permanently deletes all your scanned cards. Cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: async () => {
        try {
          // Never AsyncStorage.clear() — would nuke the Supabase auth session.
          await AsyncStorage.multiRemove(["minty_history", "minty_onboarding_seen"]);
          if (userId) await deleteAllScannedCards(userId);
          setStats({ scans: 0, gems: 0, avg: 0 });
          Alert.alert("Done", "All scanned cards have been cleared.");
        } catch (err: any) {
          Alert.alert("Couldn't clear data", err?.message ?? "Please try again.");
        }
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and all associated data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Prefer the delete-account edge function: it revokes the user's
              // Sign-in-with-Apple authorization (Apple 5.1.1(v)) THEN purges
              // their data. Falls back to the RPC if the function isn't
              // deployed yet (covers the period before Apple secrets are set).
              if (userId && supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                const accessToken = session?.access_token;
                const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
                let succeeded = false;
                if (accessToken && baseUrl) {
                  try {
                    const res = await fetch(`${baseUrl}/functions/v1/delete-account`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                    });
                    if (res.ok) succeeded = true;
                  } catch {}
                }
                if (!succeeded) {
                  // Fallback path: data-only purge via RPC. SIWA users will
                  // still need their Apple authorization revoked manually
                  // (Settings → Apple ID → Apps Using Your Apple ID).
                  await supabase.rpc("delete_user_account");
                }
              }
              await AsyncStorage.multiRemove(["minty_history", "minty_onboarding_seen", AUTH_FLOW_KEY]);
              signOut().catch(() => {});
              rootRouter.replace("/login" as any);
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to delete account.");
            }
          },
        },
      ],
    );
  };

  const displayName = isAnonymous
    ? "Guest collector"
    : (firstName || userEmail?.split("@")[0] || "Collector");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 24, paddingTop: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header — combined identity + lifetime scan count */}
      <View style={{
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
        borderRadius: 18, padding: 18, gap: 14,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.borderStrong, justifyContent: "center", alignItems: "center" }}>
            <Icon name="shield" size={22} color={C.mint} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 22, color: C.text, lineHeight: 28, paddingHorizontal: 2 }}>
              {isAnonymous ? displayName : `Hi, ${displayName}`}
            </Text>
            {userEmail && !isAnonymous && (
              <Text numberOfLines={1} style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{userEmail}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 24, color: C.mint, lineHeight: 30, paddingHorizontal: 2 }}>{stats.scans}</Text>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.textTertiary, marginTop: 2, letterSpacing: 1 }}>SCANS</Text>
          </View>
        </View>
      </View>

      {/* Pro upsell removed for v1.0 — IAP returns in v1.1 after RevenueCat wiring. */}

      {isAnonymous && (
        <Section title="ACCOUNT">
          <Row icon="user" label="Sign in to save your collection" onPress={() => rootRouter.push("/login" as any)} />
        </Section>
      )}

      {/* General */}
      <Section title="GENERAL">
        <Row icon="info" label="How to get the best grade" onPress={() => AsyncStorage.removeItem("minty_onboarding_seen").then(() => router.push("/onboarding" as any))} />
      </Section>

      {/* About + Account & Data — Delete Account surfaced at top level
          for Apple Guideline 5.1.1(v) discoverability. */}
      <Section title="ABOUT">
        <Row icon="lock" label="Privacy Policy" onPress={() => router.push("/privacy" as any)} />
        <Divider />
        <Row icon="doc" label="Terms of Service" onPress={() => router.push("/terms" as any)} />
      </Section>

      <Section title="ACCOUNT & DATA">
        <Row icon="history" label="Clear All Data" onPress={handleClearData} destructive />
        <Divider />
        <Row icon="logout" label="Delete Account" onPress={handleDeleteAccount} destructive />
      </Section>

      {/* Sign out — subtle text link, not a destructive Row */}
      {!isAnonymous && (
        <Pressable
          onPress={() => {
            AsyncStorage.removeItem(AUTH_FLOW_KEY).catch(() => {});
            signOut().catch(() => {});
            rootRouter.replace("/login" as any);
          }}
          style={({ pressed }) => ({ alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ fontSize: 13, color: C.textTertiary, fontFamily: FONT.ui }}>Sign out</Text>
        </Pressable>
      )}

      <Text style={{ fontSize: 11, color: C.textDisabled, textAlign: "center", lineHeight: 16, paddingHorizontal: 16, marginTop: 4 }}>
        v1.0.0 · Minty is not affiliated with any professional grading service.{"\n"}Grade predictions are AI estimates only.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontFamily: FONT.display, fontSize: 24, color: accent ?? C.text, lineHeight: 30, paddingHorizontal: 4 }}>{value}</Text>
      <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.textTertiary, marginTop: 4, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}
