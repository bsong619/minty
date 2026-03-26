import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{title}</Text>
      <Text style={{ fontSize: 14, color: C.textSecondary, lineHeight: 22 }}>{children}</Text>
    </View>
  );
}

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 24, gap: 22, paddingBottom: 120 + insets.bottom }}
      >
        <View style={{ gap: 6, paddingTop: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: C.text, letterSpacing: -0.5 }}>Terms of Service</Text>
          <Text style={{ fontSize: 13, color: C.textTertiary }}>Last updated: March 2026</Text>
        </View>

        <Section title="1. Acceptance of Terms">
          By downloading, installing, or using Minty ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App. These terms constitute a legal agreement between you and Minty.
        </Section>

        <Section title="2. Description of Service">
          Minty provides AI-powered card grading estimates for collectible trading cards. The App analyzes card images using artificial intelligence and returns predicted grade estimates on a 1-10 scale. These are estimates only and are not official grades from any grading authority.
        </Section>

        <Section title="3. Disclaimer of Accuracy">
          Minty is not affiliated with, endorsed by, or connected to PSA (Professional Sports Authenticator), BGS (Beckett Grading Services), CGC, or any other professional grading company. Our AI predictions are estimates based on image analysis and may differ significantly from official grades. We make no warranties about the accuracy, reliability, or completeness of any grade predictions. You should not rely solely on Minty's estimates when making purchasing, selling, or submission decisions.
        </Section>

        <Section title="4. User Accounts and Authentication">
          You may create an account using email/password, Sign in with Apple, or Google Sign-In. You may also use the App as a guest with limited features. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate information when creating an account. You may delete your account at any time from the Settings screen.
        </Section>

        <Section title="5. Subscriptions and Payments">
          Minty offers a free tier with 3 scans per day and a Pro subscription with unlimited scans and additional features. Subscriptions are billed through the Apple App Store. Payment is charged to your Apple ID account at confirmation of purchase. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current billing period. You can manage and cancel subscriptions in your device Settings under Apple ID > Subscriptions. No refunds are provided for partial subscription periods.
        </Section>

        <Section title="6. Acceptable Use">
          You agree not to: (a) use the App for any unlawful purpose; (b) attempt to reverse engineer, decompile, or exploit the App or its AI systems; (c) submit fraudulent, misleading, or manipulated card images; (d) interfere with or disrupt the App's infrastructure; (e) create multiple accounts to circumvent scan limits; (f) scrape, harvest, or collect data from the App.
        </Section>

        <Section title="7. Intellectual Property">
          All content, features, functionality, and design of Minty are owned by Minty and protected by copyright, trademark, and other intellectual property laws. The Minty name, logo, and brand elements are trademarks of Minty. Card images submitted by users remain the property of the user. Trading card artwork displayed from the Pokemon TCG API is the property of its respective owners.
        </Section>

        <Section title="8. Limitation of Liability">
          To the fullest extent permitted by applicable law, Minty and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or other intangible losses arising from: (a) your use of or inability to use the App; (b) financial decisions made based on grade estimates; (c) unauthorized access to your account; (d) any interruption or cessation of the service. Our total liability shall not exceed the amount you paid for the App in the 12 months prior to the claim.
        </Section>

        <Section title="9. Indemnification">
          You agree to indemnify and hold harmless Minty and its operators from any claims, losses, damages, liabilities, and expenses arising from your use of the App, your violation of these Terms, or your violation of any rights of a third party.
        </Section>

        <Section title="10. Termination">
          We may suspend or terminate your access to the App at any time for violation of these Terms or for any reason at our sole discretion. Upon termination, your right to use the App ceases immediately. You may delete your account at any time, which will remove your data as described in our Privacy Policy.
        </Section>

        <Section title="11. Governing Law">
          These Terms shall be governed by the laws of the State of California, United States, without regard to conflict of law provisions. Any disputes arising from these Terms shall be resolved in the courts of California.
        </Section>

        <Section title="12. Changes to Terms">
          We reserve the right to modify these Terms at any time. Material changes will be communicated through the App. Your continued use after changes constitutes acceptance of the new Terms.
        </Section>

        <Section title="13. Contact">
          If you have questions about these Terms, contact us at song.brenden@gmail.com.
        </Section>
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + insets.bottom, backgroundColor: C.bg, borderTopWidth: 0.5, borderTopColor: C.borderSubtle }}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            padding: 16, borderRadius: 16, borderCurve: "continuous",
            backgroundColor: C.red, alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>I Agree</Text>
        </Pressable>
      </View>
    </View>
  );
}
