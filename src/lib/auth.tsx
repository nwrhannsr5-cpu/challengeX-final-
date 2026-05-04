import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type UserRow } from "./supabase";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: UserRow | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string, email: string | null) => {
    const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (data) {
      setProfile(data as UserRow);
      return;
    }
    const fallbackName = email?.split("@")[0] || "Challenger";
    const { data: created } = await supabase
      .from("users")
      .insert({
        id: userId,
        email,
        name: fallbackName,
        full_name: fallbackName,
        username: fallbackName,
        total_points: 0,
        profile_completed: false,
      })
      .select("*")
      .maybeSingle();
    setProfile((created as UserRow) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) setTimeout(() => loadProfile(s.user.id, s.user.email ?? null), 0);
      else setProfile(null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id, data.session.user.email ?? null).finally(() =>
          setLoading(false),
        );
      } else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        loading,
        signIn: async (email, password) => {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        },
        signUp: async (email, password) => {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/` },
          });
          if (error) throw error;
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
        refreshProfile: async () => {
          if (session?.user) await loadProfile(session.user.id, session.user.email ?? null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
