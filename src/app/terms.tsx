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
          By downloading, installing, or using Minty ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not access or use the App. These Terms constitute a legally binding agreement between you and Brenden Song, operating as Minty ("we," "us," or "our").
        </Section>

        <Section title="2. Description of Service">
          Minty provides AI-powered grading estimates for collectible trading cards, primarily Pokémon Trading Card Game cards. The App uses artificial intelligence to analyze photographs of cards and returns predicted grade estimates on a 1–10 scale modeled after the PSA grading system, along with sub-grade breakdowns for centering, corners, edges, and surface condition. These are AI-generated estimates only. They are not official grades from any professional grading authority.
        </Section>

        <Section title="3. Disclaimer of Accuracy">
          Minty is not affiliated with, endorsed by, or connected to PSA (Professional Sports Authenticator), BGS (Beckett Grading Services), CGC (Certified Guaranty Company), or any other professional card grading company. Our AI predictions are estimates based on image analysis and may differ significantly from official grades. We make no warranties or representations about the accuracy, reliability, or completeness of any grade predictions. You should not rely solely on Minty's estimates when making purchasing, selling, or grading submission decisions. We are not responsible for any financial losses or decisions made based on our AI grade predictions.
        </Section>

        <Section title="4. User Accounts & Authentication">
          You may create an account using email/password, Sign in with Apple, or Google Sign-In. You may also use the App as a guest with limited functionality (3 free scans per day). You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate information when creating an account and must not create multiple accounts to circumvent usage limits. You may delete your account at any time from the Settings screen.
        </Section>

        <Section title="5. Subscriptions & Payments">
          Minty offers a free tier with limited daily scans and a Pro subscription with unlimited scans and additional features. Subscriptions are billed through Apple's App Store at the price displayed at time of purchase. Payment is charged to your Apple ID account at confirmation of purchase. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current billing period. You can manage and cancel subscriptions in your device's Settings > Apple ID > Subscriptions. No refunds are provided for partial subscription periods; refund requests must be directed to Apple. Prices may change with notice; continuing to use the service after a price change constitutes acceptance.
        </Section>

        <Section title="6. Acceptable Use">
          You agree not to: (a) use the App for any unlawful purpose or in violation of any applicable laws; (b) attempt to reverse engineer, decompile, disassemble, or otherwise exploit the App or its AI systems; (c) submit fraudulent, misleading, or intentionally manipulated card images to deceive other users; (d) interfere with, disrupt, or place an undue burden on the App's infrastructure or servers; (e) create multiple accounts to circumvent scan limits or other usage restrictions; (f) scrape, harvest, crawl, or collect data from the App by automated means; (g) use the App to infringe upon the intellectual property rights of any third party; (h) resell, redistribute, or commercially exploit grade results without our written consent.
        </Section>

        <Section title="7. Intellectual Property">
          All content, features, functionality, and design of Minty — including but not limited to the AI grading algorithms, user interface, graphics, and branding — are owned by Minty and protected by copyright, trademark, and other intellectual property laws. Card images submitted by users remain the property of the user. Trading card artwork displayed from the Pokémon TCG API is the property of The Pokémon Company, Nintendo, and their respective licensors.
        </Section>

        <Section title="8. Limitation of Liability">
          To the fullest extent permitted by applicable law, Minty and its operator shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, revenue, or data, financial decisions made based on AI grade estimates, unauthorized access to or alteration of your account, any interruption, suspension, or cessation of the service, and differences between AI-predicted grades and official grades from grading authorities. Our total aggregate liability for all claims arising from or related to your use of the App shall not exceed the amount you paid for the App or subscription in the twelve (12) months immediately preceding the claim.
        </Section>

        <Section title="9. Indemnification">
          You agree to indemnify, defend, and hold harmless Minty and its operator from and against any claims, losses, damages, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from or related to your use of the App, your violation of these Terms, your violation of any rights of a third party, or any content or data you submit through the App.
        </Section>

        <Section title="10. Termination">
          We may suspend or terminate your access to the App at any time, with or without cause, including for violation of these Terms. Upon termination, your right to use the App ceases immediately. You may delete your account at any time from the Settings screen, which will remove your data as described in our Privacy Policy. Sections 3, 8, 9, and 11 survive any termination of these Terms.
        </Section>

        <Section title="11. Governing Law & Disputes">
          These Terms shall be governed by and construed in accordance with the laws of the State of California, United States, without regard to conflict of law provisions. Any disputes arising from or related to these Terms or your use of the App shall be resolved exclusively in the state or federal courts located in San Diego County, California.
        </Section>

        <Section title="12. Severability">
          If any provision of these Terms is found to be unenforceable or invalid by a court of competent jurisdiction, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
        </Section>

        <Section title="13. Entire Agreement">
          These Terms, together with our Privacy Policy, constitute the entire agreement between you and Minty regarding your use of the App and supersede all prior agreements and understandings.
        </Section>

        <Section title="14. Changes to Terms">
          We reserve the right to modify these Terms at any time. Material changes will be communicated through the App. Your continued use of Minty after changes are posted constitutes acceptance of the revised Terms. If you do not agree to the updated Terms, you must stop using the App.
        </Section>

        <Section title="15. Contact">
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
