import { View, Text, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RevenueCatUI from "react-native-purchases-ui";
import { Icon } from "@/components/icon";
import { C, FONT } from "@/lib/theme";
import { isIapConfigured } from "@/lib/iap";

// RevenueCat Customer Center — manage subscription, request refunds (iOS),
// view purchase history, contact support. UI is configured in the RC dashboard
// so changes ship without an app rebuild.

export default function CustomerCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!isIapConfigured) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 12 }}>
        <View style={{ paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="close" size={20} color={C.text} />
          </Pressable>
          <Text style={{ fontFamily: FONT.uiBold, fontSize: 14, color: C.text }}>Manage subscription</Text>
          <View style={{ width: 20 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Text style={{ fontSize: 13, color: C.textSecondary, textAlign: "center" }}>
            Subscription management is unavailable while billing is being configured.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <RevenueCatUI.CustomerCenterView
      style={{ flex: 1 }}
      onDismiss={() => router.back()}
      onShowingManageSubscriptions={() => { /* fired when the system sheet opens */ }}
      onRestoreFailed={({ error }) => {
        Alert.alert("Restore failed", error.message ?? "Please try again.");
      }}
    />
  );
}
