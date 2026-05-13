import { Alert, Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { PurchasesPackage } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { Icon, type IconName } from "@/components/icon";
import { C, FONT, SHADOW } from "@/lib/theme";
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  isIapConfigured,
  PRO_ENTITLEMENT,
} from "@/lib/iap";

// When RC is configured we render their dashboard-driven Paywall component —
// edits in the RC dashboard ship without an app rebuild. When RC isn't
// configured (no SDK key in env) we fall back to the hand-built tile picker
// so the design still works during pre-billing development.

const FEATURES: { i: IconName; t: string; d: string }[] = [
  { i: "infinity",  t: "Unlimited scans",      d: "Free tier: 5 / day" },
  { i: "trend",     t: "Live market values",   d: "Real-time prices + 30-day trends" },
  { i: "stack",     t: "Pro vault analytics",  d: "Portfolio insights & alerts" },
  { i: "share",     t: "HD share cards",       d: "Watermark-free for socials" },
  { i: "sparkles",  t: "Priority AI",          d: "Faster, more confident grades" },
];

export default function PaywallScreen() {
  const router = useRouter();

  if (isIapConfigured) {
    // RC handles the entire UI: offering layout, plan picker, trial copy,
    // localized prices, purchase + restore buttons, and the Apple disclosures.
    // We just react to the result.
    return (
      <RevenueCatUI.Paywall
        onPurchaseCompleted={() => router.back()}
        onRestoreCompleted={({ customerInfo }) => {
          if (customerInfo.entitlements.active[PRO_ENTITLEMENT]) router.back();
        }}
        onDismiss={() => router.back()}
      />
    );
  }

  // ---- Fallback (no RC key) — same design as before --------------------
  return <FallbackPaywall />;
}

function FallbackPaywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<"annual" | "monthly">("annual");
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | null>(null);
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isIapConfigured) return;
    let cancelled = false;
    getOfferings().then((off) => {
      if (cancelled || !off) return;
      const annual = off.availablePackages.find((p) => p.packageType === "ANNUAL")
        ?? off.annual ?? null;
      const monthly = off.availablePackages.find((p) => p.packageType === "MONTHLY")
        ?? off.monthly ?? null;
      setAnnualPkg(annual);
      setMonthlyPkg(monthly);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubscribe = async () => {
    if (!isIapConfigured) {
      Alert.alert("Pro is coming soon", "Minty is free while we finalize Pro features. Thanks for your patience!", [{ text: "OK" }]);
      return;
    }
    const pkg = plan === "annual" ? annualPkg : monthlyPkg;
    if (!pkg) {
      Alert.alert("Unavailable", "Couldn't load subscription options. Please try again.", [{ text: "OK" }]);
      return;
    }
    setBusy(true);
    const res = await purchasePackage(pkg);
    setBusy(false);
    if (res.cancelled) return;
    if (!res.ok) {
      Alert.alert("Purchase failed", res.error ?? "Something went wrong. Please try again.", [{ text: "OK" }]);
      return;
    }
    Alert.alert("Welcome to Pro", "You've unlocked unlimited scans.", [{ text: "Done", onPress: () => router.back() }]);
  };

  const handleRestore = async () => {
    if (!isIapConfigured) {
      Alert.alert("Nothing to restore", "Billing isn't set up yet.", [{ text: "OK" }]);
      return;
    }
    setBusy(true);
    const res = await restorePurchases();
    setBusy(false);
    if (res.ok) {
      Alert.alert("Restored", "Your Pro subscription is active again.", [{ text: "Done", onPress: () => router.back() }]);
    } else {
      Alert.alert("No purchases found", res.error ?? "We couldn't find an active Pro subscription on this Apple ID.", [{ text: "OK" }]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient
        colors={[`${C.mint}30`, "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
      />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, alignItems: "center" }}
        showsVerticalScrollIndicator={false}
      >
       <View style={{ width: "100%", maxWidth: 520, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="close" size={20} color={C.text} />
          </Pressable>
          <Pressable hitSlop={8} onPress={handleRestore} disabled={busy}>
            <Text style={{ fontSize: 12, color: C.mint, fontFamily: FONT.uiBold, opacity: busy ? 0.5 : 1 }}>Restore</Text>
          </Pressable>
        </View>

        <View style={{ alignItems: "center", marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 100, backgroundColor: C.surface, borderWidth: 1, borderColor: C.mintFaint }}>
            <Text style={{ fontSize: 12 }}>✦</Text>
            <Text style={{ fontFamily: FONT.monoBold, fontSize: 10, color: C.mint, letterSpacing: 1 }}>MINTY PRO</Text>
          </View>
          <Text style={{ fontFamily: FONT.display, fontSize: 44, color: C.text, lineHeight: 52, marginTop: 14, textAlign: "center", paddingHorizontal: 12 }}>
            Grade like a{"\n"}
            <Text style={{ color: C.mint, fontFamily: FONT.displayItalic }}>pro</Text>
          </Text>
          <Text style={{ fontSize: 13, color: C.textSecondary, marginTop: 8, lineHeight: 19, textAlign: "center", maxWidth: 280 }}>
            Unlimited scans, live market data, and the tools serious collectors use.
          </Text>
        </View>

        <View style={{ marginTop: 24, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: "hidden" }}>
          {FEATURES.map((f, i) => (
            <View key={f.t} style={{
              flexDirection: "row", alignItems: "center", gap: 14, padding: 14,
              borderBottomWidth: i === FEATURES.length - 1 ? 0 : 1, borderBottomColor: C.borderSubtle,
            }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.mintFaint, justifyContent: "center", alignItems: "center" }}>
                <Icon name={f.i} size={16} color={C.mint} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text }}>{f.t}</Text>
                <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{f.d}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16, gap: 8 }}>
          <Pressable
            onPress={() => setPlan("annual")}
            style={{
              position: "relative", padding: 16, borderRadius: 14,
              backgroundColor: plan === "annual" ? C.mintFaint : C.surface,
              borderWidth: plan === "annual" ? 2 : 1,
              borderColor: plan === "annual" ? C.mint : C.border,
            }}
          >
            <View style={{ position: "absolute", top: -10, left: 14, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 100, backgroundColor: C.gold }}>
              <Text style={{ fontFamily: FONT.monoBold, fontSize: 9, color: C.onMint, letterSpacing: 1 }}>BEST VALUE</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text }}>Annual</Text>
                <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>$3.33/mo · billed yearly</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontFamily: FONT.display, fontSize: 24, color: plan === "annual" ? C.mint : C.text, lineHeight: 30, paddingHorizontal: 2 }}>
                  {annualPkg?.product.priceString ?? "$39.99"}
                </Text>
                <Text style={{ fontSize: 10, color: C.textTertiary, marginTop: 2, textDecorationLine: "line-through" }}>$95.88</Text>
              </View>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setPlan("monthly")}
            style={{
              padding: 14, borderRadius: 14,
              backgroundColor: plan === "monthly" ? C.mintFaint : C.surface,
              borderWidth: plan === "monthly" ? 2 : 1,
              borderColor: plan === "monthly" ? C.mint : C.border,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 14, fontFamily: FONT.uiBold, color: C.text }}>Monthly</Text>
                <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>Cancel anytime</Text>
              </View>
              <Text style={{ fontFamily: FONT.display, fontSize: 22, color: plan === "monthly" ? C.mint : C.text, lineHeight: 28, paddingHorizontal: 2 }}>
                {monthlyPkg?.product.priceString ?? "$7.99"}
              </Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          onPress={handleSubscribe}
          disabled={busy}
          style={({ pressed }) => ({
            marginTop: 14, paddingVertical: 16, borderRadius: 14,
            backgroundColor: C.mint, alignItems: "center",
            opacity: busy ? 0.7 : pressed ? 0.85 : 1,
            ...({ boxShadow: SHADOW.glow } as any),
            flexDirection: "row", justifyContent: "center", gap: 10,
          })}
        >
          {busy ? (
            <>
              <ActivityIndicator color={C.onMint} />
              <Text style={{ fontFamily: FONT.uiBold, fontSize: 15, color: C.onMint }}>Working…</Text>
            </>
          ) : (
            <Text style={{ fontFamily: FONT.uiBold, fontSize: 15, color: C.onMint }}>Start 7-day free trial</Text>
          )}
        </Pressable>
        <Text style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: C.textTertiary, lineHeight: 16, paddingHorizontal: 8 }}>
          Annual: $39.99/year ($3.33/month). Monthly: $7.99/month. Subscription auto-renews until canceled at least 24 hours before the end of the current period. Manage or cancel in your Apple ID account settings.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 12 }}>
          <Pressable onPress={() => router.push("/terms" as any)} hitSlop={8}>
            <Text style={{ fontSize: 11, color: C.textSecondary, textDecorationLine: "underline" }}>Terms of Use (EULA)</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/privacy" as any)} hitSlop={8}>
            <Text style={{ fontSize: 11, color: C.textSecondary, textDecorationLine: "underline" }}>Privacy Policy</Text>
          </Pressable>
        </View>
       </View>
      </ScrollView>
    </View>
  );
}

// Suppress "PAYWALL_RESULT imported but unused" — kept around so future callers
// can switch to RevenueCatUI.presentPaywall() without re-importing.
void PAYWALL_RESULT;
