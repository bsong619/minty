import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { ensureAuth, signOut as supabaseSignOut, supabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthContextValue {
  userId: string | null;
  userEmail: string | null;
  isAnonymous: boolean;
  loading: boolean;
  pendingLogout: boolean;
  signOut: () => Promise<void>;
  requestLogout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  userId: null,
  userEmail: null,
  isAnonymous: true,
  loading: true,
  pendingLogout: false,
  signOut: async () => {},
  requestLogout: () => {},
  refreshAuth: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pendingLogout, setPendingLogout] = useState(false);

  const loadAuth = useCallback(async () => {
    try {
      const id = await ensureAuth();
      setUserId(id);
      if (id && isSupabaseConfigured && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        setUserEmail(user?.email ?? null);
        setIsAnonymous(user?.is_anonymous ?? true);
      }
    } catch (err) {
      console.warn("Auth error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuth();

    if (!isSupabaseConfigured) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);
      setIsAnonymous(session?.user?.is_anonymous ?? true);
    });
    return () => subscription.unsubscribe();
  }, [loadAuth]);

  const handleSignOut = useCallback(async () => {
    await supabaseSignOut();
    setUserId(null);
    setUserEmail(null);
    setIsAnonymous(true);
    setPendingLogout(false);
  }, []);

  const requestLogout = useCallback(() => setPendingLogout(true), []);

  return (
    <AuthContext value={{ userId, userEmail, isAnonymous, loading, pendingLogout, signOut: handleSignOut, requestLogout, refreshAuth: loadAuth }}>
      {children}
    </AuthContext>
  );
}
