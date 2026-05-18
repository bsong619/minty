import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, SHADOW } from "@/lib/theme";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
          We collect information you provide directly when using Minty: email address (if you create an account or sign in with Apple/Google), card images you submit for AI grading analysis, and scan history, grading results, and collection data. We also automatically collect device type, operating system version, and crash reports to improve app stability. We do not collect precise location data.
        </Section>

        <Section title="2. Authentication & Account Data">
          Minty uses Supabase Authentication to manage user accounts. You can sign in with email/password, Sign in with Apple, or Google Sign-In. Authentication tokens are stored securely on your device using encrypted storage. Anonymous guest accounts are created automatically and do not require personally identifiable information. If you later create a full account, your guest data is migrated to your authenticated profile.
        </Section>

        <Section title="3. How We Use Your Information">
          We use your information to: provide and improve the AI card grading service, maintain your card collection history, send account-related communications (verification, password reset), and analyze aggregated app usage to improve performance and stability. We do not sell, rent, or share your personal information with third parties for marketing or advertising purposes.
        </Section>

        <Section title="4. Card Images & AI Processing — What We Share, With Whom, and Why">
          When you tap "Scan a card," the image you provide is sent over a secure (TLS 1.2+) API connection to Anthropic, PBC ("Anthropic"), the developer of Claude AI, located in the United States. The only data Minty sends to Anthropic is the card photo you select; no account email, no device identifier, and no location data are attached.{"\n\n"}Anthropic uses the image only to return a grading analysis to Minty. Per Anthropic's API terms, API inputs are not used to train Anthropic's AI models, and images are not retained by Anthropic after the API response is returned. You can review Anthropic's commercial terms and privacy policy at anthropic.com.{"\n\n"}Before your first card photo is sent to Anthropic, Minty asks for your explicit consent through an in-app dialog. You can decline, in which case no image is shared and no scan occurs. If you accept, your consent is remembered locally on your device so we don't ask every time; clearing app data or reinstalling resets this.{"\n\n"}For authenticated users, your card images are also stored in Supabase Storage (hosted on AWS, US region) and associated with your account so you can revisit your collection. You may delete individual cards or your entire account at any time from the Profile screen.
        </Section>

        <Section title="5. Data Storage & Security">
          Your data is stored securely using Supabase, which is SOC 2 Type II certified and hosted on Amazon Web Services (AWS) infrastructure. We implement industry-standard security measures including encryption in transit via TLS 1.2+, encryption at rest via AES-256, Row Level Security (RLS) policies ensuring users can only access their own data, and secure authentication token storage on-device. No method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security but continuously work to protect your data.
        </Section>

        <Section title="6. Third-Party Services">
          Minty integrates with the following third-party services, each operating under its own privacy policy: Supabase (database, authentication, and file storage), Anthropic Claude AI (card image analysis and grading), Apple App Store (payment processing, app distribution, and Sign in with Apple), and Google (Google Sign-In authentication).
        </Section>

        <Section title="7. Data Retention & Deletion">
          We retain your account data for as long as your account is active. You can delete individual cards from your collection at any time within the app. You can delete your entire account from the Settings screen, which will permanently remove your profile, scan history, card images, and all associated data within 30 days. Some anonymized, aggregated analytics data may be retained for service improvement purposes.
        </Section>

        <Section title="8. Your Rights">
          Depending on your jurisdiction, you have the right to: access the personal data we hold about you, correct inaccurate or incomplete data, request deletion of your data and account, export your data in a portable format, and object to or restrict certain processing of your data. California residents (CCPA): You have the right to know what personal information is collected, request its deletion, and opt out of its sale. We do not sell personal information. European users (GDPR): You have the right to data portability, the right to be forgotten, and the right to lodge a complaint with your local supervisory authority. To exercise any of these rights, contact us at song.brenden@gmail.com.
        </Section>

        <Section title="9. Children's Privacy">
          Minty is not directed to children under the age of 13 (or under 16 in the European Economic Area). We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information, we will promptly delete the account and all associated data. If you believe a child has provided us with their information, please contact us immediately.
        </Section>

        <Section title="10. Tracking & Advertising">
          Minty does not use advertising identifiers (IDFA/GAID), does not serve advertisements, does not use cookies for tracking, and does not track you across other apps or websites. We do not participate in any advertising networks or data broker arrangements.
        </Section>

        <Section title="11. International Data Transfers">
          Your data is processed and stored in the United States via AWS infrastructure. By using Minty, you consent to the transfer, processing, and storage of your data in the United States. For European users, these transfers are conducted in compliance with GDPR requirements.
        </Section>

        <Section title="12. Changes to This Policy">
          We may update this Privacy Policy from time to time to reflect changes in our practices or applicable law. Material changes will be communicated through the app. The "Last updated" date at the top will be updated accordingly. Your continued use of Minty after changes constitutes acceptance of the updated policy.
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
          <Text style={{ fontSize: 16, fontWeight: "600", color: "white" }}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}
