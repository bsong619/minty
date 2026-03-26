import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useSubscription } from "@/hooks/use-subscription";
import { C, SHADOW } from "@/lib/theme";
import { PRODUCT_IDS, ProductId } from "@/lib/iap-service";

const FEATURES = [
  { icon: "infinity", label: "Unlimited card scans" },
  { icon: "sparkles", label: "Lightning-fast AI grading" },
  { icon: "square.stack.3d.up", label: "Complete collection tracker" },
];

function FeatureRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          borderCurve: "continuous",
          backgroundColor: C.goldFaint,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Image
          source={`sf:${icon}`}
          style={{ width: 16, height: 16, tintColor: C.gold as any }}
        />
      </View>
      <Text style={{ fontSize: 15, color: C.text, flex: 1 }}>{label}</Text>
      <Image
        source="sf:checkmark.circle.fill"
        style={{ width: 20, height: 20, tintColor: "#3DD68C" as any }}
      />
    </View>
  );
}

function PlanCard({
  productId,
  title,
  price,
  period,
  badge,
  selected,
  onSelect,
}: {
  productId: ProductId;
  title: string;
  price: string;
  period: string;
  badge?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => ({
        borderRadius: 16,
        borderCurve: "continuous",
        padding: 16,
        backgroundColor: selected ? C.goldFaint : C.surface,
        borderWidth: 2,
        borderColor: selected ? C.gold : C.border,
        opacity: pressed ? 0.85 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? C.gold : C.textTertiary,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {selected && (
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: C.gold,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>
            {title}
          </Text>
          {badge && (
            <View
              style={{
                backgroundColor: C.gold,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{ fontSize: 11, fontWeight: "700", color: "#0A0A0C" }}
              >
                {badge}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
          {period}
        </Text>
      </View>
      <Text style={{ fontSize: 18, fontWeight: "800", color: C.text }}>
        {price}
      </Text>
    </Pressable>
  );
}

export default function PaywallScreen() {
  const router = useRouter();
  const { products, purchase, restore, isLoading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<ProductId>(
    PRODUCT_IDS.annual
  );
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const monthlyProduct = products.find(
    (p) => p.productId === PRODUCT_IDS.monthly
  );
  const annualProduct = products.find(
    (p) => p.productId === PRODUCT_IDS.annual
  );

  const monthlyPrice = monthlyProduct?.localizedPrice ?? "$4.99";
  const annualPrice = annualProduct?.localizedPrice ?? "$29.99";

  const handlePurchase = useCallback(async () => {
    setPurchasing(true);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    const result = await purchase(selectedPlan);
    setPurchasing(false);

    if (result.status === "success") {
      Alert.alert(
        "Welcome to Pro!",
        "Your subscription is now active. Enjoy unlimited scans.",
        [{ text: "Let's Go!", onPress: () => router.back() }]
      );
    } else if (result.status === "error") {
      Alert.alert("Purchase Failed", result.message);
    }
    // cancelled — do nothing
  }, [purchase, selectedPlan, scale, router]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    const result = await restore();
    setRestoring(false);

    if (result.status === "success") {
      Alert.alert("Restored!", "Your Pro subscription has been restored.", [
        { text: "Thanks!", onPress: () => router.back() },
      ]);
    } else {
      Alert.alert(
        "No Purchase Found",
        result.message ?? "No active subscription was found."
      );
    }
  }, [restore, router]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 120 }}
      >
        {/* Header */}
        <View style={{ alignItems: "center", gap: 12, paddingTop: 8 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: C.gold,
              justifyContent: "center",
              alignItems: "center",
              boxShadow: "0px 8px 24px rgba(255,215,0,0.4)",
            }}
          >
            <Image
              source="sf:crown.fill"
              style={{ width: 36, height: 36, tintColor: "white" as any }}
            />
          </View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: C.text,
              textAlign: "center",
            }}
          >
            Minty Pro
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: C.textSecondary,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            Unlimited grading power for serious collectors
          </Text>
        </View>

        {/* Features */}
        <View
          style={{
            borderRadius: 16,
            borderCurve: "continuous",
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.border,
            padding: 16,
            gap: 16,
          }}
        >
          {FEATURES.map((f) => (
            <FeatureRow key={f.icon} icon={f.icon} label={f.label} />
          ))}
        </View>

        {/* Plan selection */}
        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: C.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginLeft: 4,
            }}
          >
            Choose Your Plan
          </Text>
          <PlanCard
            productId={PRODUCT_IDS.annual}
            title="Annual"
            price={annualPrice}
            period={`${annualPrice}/year • Save over 50%`}
            badge="BEST VALUE"
            selected={selectedPlan === PRODUCT_IDS.annual}
            onSelect={() => setSelectedPlan(PRODUCT_IDS.annual)}
          />
          <PlanCard
            productId={PRODUCT_IDS.monthly}
            title="Monthly"
            price={monthlyPrice}
            period={`${monthlyPrice}/month`}
            selected={selectedPlan === PRODUCT_IDS.monthly}
            onSelect={() => setSelectedPlan(PRODUCT_IDS.monthly)}
          />
        </View>
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 20,
          paddingBottom: 36,
          gap: 12,
          backgroundColor: C.bgElevated,
          borderTopWidth: 0.5,
          borderTopColor: C.borderSubtle,
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPress={handlePurchase}
            disabled={purchasing || isLoading}
            style={({ pressed }) => ({
              borderRadius: 14,
              borderCurve: "continuous",
              backgroundColor: C.gold,
              padding: 16,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || purchasing ? 0.8 : 1,
              boxShadow: SHADOW.goldGlow,
              flexDirection: "row",
              gap: 8,
            })}
          >
            {purchasing ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Image
                  source="sf:crown.fill"
                  style={{ width: 18, height: 18, tintColor: "#0A0A0C" as any }}
                />
                <Text
                  style={{ fontSize: 17, fontWeight: "700", color: "#0A0A0C" }}
                >
                  {selectedPlan === PRODUCT_IDS.annual
                    ? `Subscribe Annually — ${annualPrice}`
                    : `Subscribe Monthly — ${monthlyPrice}`}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={handleRestore}
          disabled={restoring}
          style={{ alignItems: "center", padding: 8 }}
        >
          {restoring ? (
            <ActivityIndicator color={C.textSecondary as any} size="small" />
          ) : (
            <Text style={{ fontSize: 14, color: C.textSecondary }}>
              Restore Purchases
            </Text>
          )}
        </Pressable>

        <Text
          style={{
            fontSize: 11,
            color: C.textDisabled,
            textAlign: "center",
            lineHeight: 16,
          }}
        >
          Payment will be charged to your Apple ID account at confirmation of purchase. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in Settings → Apple ID → Subscriptions.{"\n"}
          <Text onPress={() => router.push("/terms" as any)} style={{ textDecorationLine: "underline", color: C.textTertiary }}>Terms of Service</Text>
          {"  ·  "}
          <Text onPress={() => router.push("/privacy" as any)} style={{ textDecorationLine: "underline", color: C.textTertiary }}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}
