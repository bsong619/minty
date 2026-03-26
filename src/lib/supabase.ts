import "react-native-get-random-values";
import { createClient } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

function makeClient() {
  const isClient = typeof window !== "undefined";
  let storage: any = undefined;
  if (isClient) {
    storage = require("@react-native-async-storage/async-storage").default;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage,
      autoRefreshToken: isClient,
      persistSession: isClient,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
}

export const supabase = isSupabaseConfigured ? makeClient() : (null as any);

export async function ensureAuth(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user!.id;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPasswordForEmail(email: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "minty://reset-password",
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signInWithApple(identityToken: string): Promise<string | null> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: identityToken,
  });
  if (error) throw error;
  return data.user?.id ?? null;
}

export async function signInWithGoogle(): Promise<string | null> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const redirectTo = Linking.createURL("auth/callback");
  console.log("[Google OAuth] redirectTo:", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error("No OAuth URL returned");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) return null;

  // PKCE flow: extract ?code= from query params
  const url = new URL(result.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    if (sessionError) throw sessionError;
    return sessionData.user?.id ?? null;
  }

  // Fallback: handle implicit flow tokens returned as URL fragment (#access_token=...)
  const hashParams = new URLSearchParams(url.hash.replace("#", ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (accessToken) {
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? "",
    });
    if (sessionError) throw sessionError;
    return sessionData.user?.id ?? null;
  }

  // Last resort: session may already be set
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
