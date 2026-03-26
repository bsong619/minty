import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, SHADOW } from "@/lib/theme";

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{title}</Text>
      <Text style={{ fontSize: 14, color: C.textSecondary, lineHeight: 22 }}>{children}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
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
          <Text style={{ fontSize: 26, fontWeight: "800", color: C.text, letterSpacing: -0.5 }}>Privacy Policy</Text>
          <Text style={{ fontSize: 13, color: C.textTertiary }}>Last updated: March 2026</Text>
        </View>

        <Section title="1. Information We Collect">
          We collect information you provide directly, including: email address (if you create an account), card images you submit for grading, scan history and grading results, and subscription status. When you sign in with Apple or Google, we receive your name and email as permitted by those services. We also automatically collect device type, operating system version, and crash reports to improve app stability.
        </Section>

        <Section title="2. Authentication and Account Data">
          Minty uses Supabase Authentication to manage user accounts. You can sign in with email/password, Sign in with Apple, or Google Sign-In. Authentication tokens are stored securely on your device. Anonymous guest accounts are created automatically and do not collect personally identifiable information. If you later create a full account, your guest data is migrated to your authenticated profile.
        </Section>

        <Section title="3. How We Use Your Information">
          We use your information to: provide and improve the card grading service, maintain your collection history, process subscription payments through Apple, send account-related communications (verification, password reset), and analyze app usage to improve performance. We do not sell, rent, or share your personal information with third parties for marketing purposes.
        </Section>

        <Section title="4. Card Images and AI Processing">
          Images you submit for grading are sent to Anthropic's Claude AI for analysis. Images are processed in real-time and are not retained by Anthropic after processing. For authenticated users, card images are stored in Supabase Storage associated with your account to maintain your collection history. You may delete individual cards or your entire collection at any time from the app.
        </Section>

        <Section title="5. Data Storage and Security">
          Your data is stored securely using Supabase, which is SOC 2 Type II certified and hosted on AWS. We implement industry-standard security measures including encryption in transit (TLS 1.2+) and encryption at rest (AES-256). Row Level Security (RLS) policies ensure users can only access their own data. However, no method of electronic transmission or storage is 100% secure.
        </Section>

        <Section title="6. Third-Party Services">
          Minty uses the following third-party services: Supabase (database, authentication, and file storage), Anthropic Claude (AI card image analysis), Apple App Store (payment processing and app distribution), and Pokemon TCG API (card artwork retrieval). Each service operates under its own privacy policy. We encourage you to review their respective policies.
        </Section>

        <Section title="7. Data Retention and Deletion">
          We retain your account data for as long as your account is active. You can delete individual cards from your collection at any time. You can delete your entire account from Settings, which will permanently remove your profile, scan history, card images, and all associated data within 30 days. Some anonymized, aggregated analytics data may be retained.
        </Section>

        <Section title="8. Your Rights">
          You have the right to: access the personal data we hold about you, correct inaccurate data, request deletion of your data and account, and export your data. California residents have additional rights under the CCPA, including the right to know what data is collected and the right to opt out of data sales (we do not sell data). To exercise any of these rights, contact us at song.brenden@gmail.com.
        </Section>

        <Section title="9. Children's Privacy">
          Minty is not directed to children under 13 (or under 16 in the EEA). We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information, we will promptly delete the account and associated data.
        </Section>

        <Section title="10. Tracking and Advertising">
          Minty does not use advertising identifiers (IDFA/GAID), does not serve advertisements, and does not track you across other apps or websites. We do not participate in any ad networks or data brokers.
        </Section>

        <Section title="11. International Users">
          Your data is processed and stored in the United States. By using Minty, you consent to the transfer of your data to the United States. We comply with applicable data protection laws including GDPR for European users and CCPA for California residents.
        </Section>

        <Section title="12. Changes to This Policy">
          We may update this Privacy Policy from time to time. Material changes will be communicated through the app or via email. Your continued use of Minty after changes constitutes acceptance of the updated policy.
        </Section>

        <Section title="13. Contact Us">
          If you have questions or concerns about this Privacy Policy or our data practices, contact us at song.brenden@gmail.com.
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
          <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>Got It</Text>
        </Pressable>
      </View>
    </View>
  );
}
