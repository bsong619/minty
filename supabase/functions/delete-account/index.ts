// Supabase Edge Function: delete-account
// ---------------------------------------
// Apple Guideline 5.1.1(v): apps that offer Sign in with Apple MUST also
// revoke the user's authorization with Apple when they delete their account.
// A simple `DELETE FROM auth.users` is NOT enough — Apple specifically wants
// the OAuth refresh token revoked at https://appleid.apple.com/auth/revoke.
//
// Flow:
//   1. Validate the user's Supabase JWT
//   2. If they signed in with Apple, look up their Apple refresh token,
//      build a client_secret JWT, and POST to Apple's revoke endpoint
//   3. Then call public.delete_user_account() which fully purges the account
//
// Required Supabase secrets (set via dashboard or CLI):
//   APPLE_TEAM_ID         e.g. 2XT6S8WHJU
//   APPLE_BUNDLE_ID       e.g. com.bsong.mintyyy  (your iOS bundle id)
//   APPLE_KEY_ID          e.g. ABC123DEFG  (from Apple Developer → Keys)
//   APPLE_PRIVATE_KEY     full contents of the .p8 file Apple emailed you,
//                         including BEGIN/END lines, newlines escaped as \n
//
// To create the Apple key:
//   1. https://developer.apple.com/account/resources/authkeys/list
//   2. Create a new key, enable "Sign in with Apple", configure for your
//      bundle id (com.bsong.mintyyy)
//   3. Download the .p8 file (one-time download — store it securely)
//   4. Note the Key ID (10-char string) shown after creation
//
// Set the secrets:
//   supabase secrets set APPLE_TEAM_ID=2XT6S8WHJU
//   supabase secrets set APPLE_BUNDLE_ID=com.bsong.mintyyy
//   supabase secrets set APPLE_KEY_ID=<your-10-char-key-id>
//   supabase secrets set APPLE_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
//
// Deploy:
//   supabase functions deploy delete-account

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.9.6/index.ts";

const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// Build the short-lived JWT Apple expects as `client_secret` on the revoke call.
// Spec: https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
async function buildAppleClientSecret(): Promise<string | null> {
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!teamId || !bundleId || !keyId || !privateKey) return null;

  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(bundleId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 5) // 5 minutes — Apple max is 6 months but short is safer
    .sign(key);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return jsonError("Server not configured", 500);

  // ---- Auth ----
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) return jsonError("Missing authorization header", 401);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) return jsonError("Invalid or expired token", 401);
  const userId = userRes.user.id;

  // ---- If user has an Apple identity, revoke their authorization with Apple ----
  // Supabase stores OAuth identities in auth.identities. We look for one with
  // provider='apple' and pull the refresh token out of identity_data.
  const { data: identities } = await supabase
    .from("auth.identities" as any)
    .select("identity_data")
    .eq("user_id", userId)
    .eq("provider", "apple");

  const appleRefreshToken = identities?.[0]?.identity_data?.refresh_token as string | undefined;

  if (appleRefreshToken) {
    const clientSecret = await buildAppleClientSecret();
    const bundleId = Deno.env.get("APPLE_BUNDLE_ID");
    if (!clientSecret || !bundleId) {
      // We have an Apple user but the Apple secrets aren't configured. Don't
      // silently delete — Apple expects revocation, so surface the gap.
      return jsonError("Apple revocation not configured on server", 500);
    }
    const body = new URLSearchParams({
      client_id: bundleId,
      client_secret: clientSecret,
      token: appleRefreshToken,
      token_type_hint: "refresh_token",
    });
    const revokeRes = await fetch(APPLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!revokeRes.ok) {
      // Apple returns 200 with empty body on success. A non-2xx means the
      // token was bad or our client_secret was rejected. Surface it but don't
      // proceed — the user should retry rather than half-delete.
      return jsonError("Apple revocation failed", 502);
    }
  }

  // ---- Now run the SQL purge (cards, profile, storage, auth row) ----
  const { error: rpcErr } = await supabase.rpc("delete_user_account");
  if (rpcErr) return jsonError(`Account deletion failed: ${rpcErr.message}`, 500);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
});
