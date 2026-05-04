import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, router as rootRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/components/auth-provider";
import { AUTH_FLOW_KEY } from "@/app/_layout";
import { supabase } from "@/lib/supabase";
import { getScannedCards } from "@/lib/card-service";
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
  const { userEmail, isAnonymous, signOut, userId } = useAuth();
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
        // Targeted removal — never AsyncStorage.clear() which would nuke the
        // Supabase auth session token and partially sign the user out.
        await AsyncStorage.multiRemove(["minty_history", "minty_onboarding_seen"]);
        Alert.alert("Done", "Local data cleared.");
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

  const displayName = isAnonymous ? "Guest collector" : (userEmail?.split("@")[0] ?? "Collector");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: insets.bottom + 100, paddingTop: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View style={{ alignItems: "center", gap: 12, paddingTop: 8 }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 36, color: C.mint, lineHeight: 36 }}>{displayName[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 24, color: C.text, lineHeight: 24, letterSpacing: -0.4 }}>{displayName}</Text>
          {userEmail && !isAnonymous && (
            <Text style={{ fontSize: 12, color: C.textSecondary }}>{userEmail}</Text>
          )}
        </View>
      </View>

      {/* Stats card */}
      <View style={{ flexDirection: "row", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 14 }}>
        <Stat label="SCANS" value={String(stats.scans)} />
        <View style={{ width: 1, backgroundColor: C.borderSubtle }} />
        <Stat label="GEMS" value={String(stats.gems)} accent={C.gold} />
        <View style={{ width: 1, backgroundColor: C.borderSubtle }} />
        <Stat label="AVG" value={stats.avg > 0 ? stats.avg.toFixed(1) : "—"} accent={stats.avg > 0 ? C.mint : C.textTertiary} />
      </View>

      {/* Pro: upsell hero (free) or manage-subscription row (subscribers). */}
      {quota.isPro ? (
        <Pressable
          onPress={() => router.push("/customer-center" as any)}
          style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", gap: 12,
            backgroundColor: C.surface, borderWidth: 1, borderColor: C.mintFaint,
            borderRadius: 16, padding: 14, opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.mintFaint, justifyContent: "center", alignItems: "center" }}>
            <Icon name="crown" size={20} color={C.mint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text }}>Minty Pro · active</Text>
            <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>Manage subscription</Text>
          </View>
          <Icon name="chevR" size={18} color={C.textTertiary} />
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push("/paywall" as any)} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
          <View style={{ position: "relative", overflow: "hidden", borderRadius: 16, borderWidth: 1, borderColor: C.mintFaint }}>
            <LinearGradient
              colors={[`${C.mint}38`, `${C.gold}26`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 16 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Text style={{ fontSize: 14 }}>✦</Text>
                <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: C.mint, letterSpacing: 1.5 }}>MINTY PRO</Text>
              </View>
              <Text style={{ fontFamily: FONT.display, fontSize: 22, color: C.text, lineHeight: 24, letterSpacing: -0.5, marginBottom: 4 }}>
                Unlock unlimited scans
              </Text>
              <Text style={{ fontSize: 12, color: C.textSecondary, lineHeight: 16, maxWidth: 260 }}>
                You&apos;ve used {quota.used} of {quota.limit} free scans today. Upgrade to keep grading without limits.
              </Text>
              <View style={{
                marginTop: 12, alignSelf: "flex-start",
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
                backgroundColor: C.mint,
                ...({ boxShadow: SHADOW.glow } as any),
              }}>
                <Text style={{ fontFamily: FONT.uiBold, fontSize: 13, color: C.onMint }}>Get more scans</Text>
                <Icon name="arrowR" size={13} color={C.onMint} strokeWidth={2.5} />
              </View>
            </LinearGradient>
          </View>
        </Pressable>
      )}

      {/* General */}
      <Section title="GENERAL">
        <Row icon="info" label="How to get the best grade" onPress={() => AsyncStorage.removeItem("minty_onboarding_seen").then(() => router.push("/onboarding" as any))} />
        <Divider />
        <Row icon="info" label="App Version" value="1.0.0" />
      </Section>

      {/* Legal */}
      <Section title="LEGAL">
        <Row icon="lock" label="Privacy Policy" onPress={() => router.push("/privacy" as any)} />
        <Divider />
        <Row icon="doc" label="Terms of Service" onPress={() => router.push("/terms" as any)} />
      </Section>

      {/* Data */}
      <Section title="DATA">
        <Row icon="history" label="Clear All Data" onPress={handleClearData} destructive />
        <Divider />
        <Row icon="logout" label="Delete Account" onPress={handleDeleteAccount} destructive />
      </Section>

      {/* Standalone sign-in / sign-out button */}
      {isAnonymous ? (
        <Pressable
          onPress={() => rootRouter.push("/login" as any)}
          style={({ pressed }) => ({
            alignSelf: "center", paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12,
            borderWidth: 1, borderColor: C.mint, backgroundColor: "transparent",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: C.mint }}>Sign in to save your collection</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            AsyncStorage.removeItem(AUTH_FLOW_KEY).catch(() => {});
            signOut().catch(() => {});
            rootRouter.replace("/login" as any);
          }}
          style={({ pressed }) => ({
            alignSelf: "center", paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: C.danger }}>Sign Out</Text>
        </Pressable>
      )}

      <Text style={{ fontSize: 11, color: C.textDisabled, textAlign: "center", lineHeight: 16, paddingHorizontal: 16 }}>
        Minty is not affiliated with any professional grading service.{"\n"}Grade predictions are AI estimates only.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontFamily: FONT.display, fontSize: 24, color: accent ?? C.text, lineHeight: 24, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.textTertiary, marginTop: 4, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}
