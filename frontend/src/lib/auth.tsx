"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { chooseInitialRole, fetchProfile, QUERY_KEYS, updateMyProfile } from "@/lib/supabase/api";
import { supabase } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/phone";
import type { Profile, Role } from "@/lib/types";

/**
 * Supabase Auth session + the signed-in user's profile row.
 * Email/password and Google OAuth both end up here.
 */

type SignUpInput = { name: string; email: string; phone: string; password: string; role: Exclude<Role, "admin"> };

type Auth = {
  /** false until the stored session (and any OAuth/email-link code in the URL) has been checked */
  ready: boolean;
  user: Profile | null;
  signUp: (input: SignUpInput, next: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<Profile | null>;
  signInWithGoogle: (next: string, role?: Exclude<Role, "admin">) => Promise<void>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateProfile: (patch: { name?: string; phone?: string | null }) => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

// Google can't carry the role picked on the sign-up page, so remember it across the redirect.
const PENDING_ROLE_KEY = "recycle-lk:pending-role";

function readError(error: { message: string } | null) {
  if (!error) return;
  const msg = error.message;
  if (/invalid login credentials/i.test(msg)) throw new Error("Wrong email or password.");
  if (/email not confirmed/i.test(msg)) throw new Error("Please confirm your email first — check your inbox for the link.");
  if (/user already registered/i.test(msg)) throw new Error("That email already has an account. Try signing in.");
  if (/password should be/i.test(msg)) throw new Error("Password must be at least 8 characters.");
  if (/provider is not enabled/i.test(msg)) throw new Error("Google sign-in isn't switched on for this project yet.");
  throw new Error(msg);
}

const redirect = (next: string) => `${window.location.origin}${next.startsWith("/") ? next : "/dashboard"}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // getSession() waits for supabase-js to finish exchanging any ?code= in the URL
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // keep this callback synchronous — supabase-js warns against awaiting in it
      setSession(next);
      setSessionReady(true);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const uid = session?.user.id;
  const profile = useQuery({
    queryKey: QUERY_KEYS.profile(uid),
    queryFn: () => fetchProfile(uid!),
    enabled: !!uid,
    staleTime: 60_000,
  });

  // First login after a Google sign-up: apply the account type they picked.
  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    let pending: string | null = null;
    try {
      pending = localStorage.getItem(PENDING_ROLE_KEY);
      localStorage.removeItem(PENDING_ROLE_KEY);
    } catch {}
    if (!pending || pending === p.role || p.role === "admin") return;
    chooseInitialRole(pending as Exclude<Role, "admin">)
      .then(() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(p.id) }))
      .catch((e: Error) => toast.error(e.message));
  }, [profile.data, queryClient]);

  const user = useMemo<Profile | null>(
    () => (profile.data && session ? { ...profile.data, email: session.user.email ?? null } : null),
    [profile.data, session],
  );

  const signUp: Auth["signUp"] = useCallback(async (input, next) => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: { full_name: input.name.trim(), phone: normalizePhone(input.phone), role: input.role },
        emailRedirectTo: redirect(next),
      },
    });
    readError(error);
    return { needsConfirmation: !data.session };
  }, []);

  const signIn: Auth["signIn"] = useCallback(
    async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      readError(error);
      const p = await queryClient.fetchQuery({ queryKey: QUERY_KEYS.profile(data.user!.id), queryFn: () => fetchProfile(data.user!.id) });
      return p;
    },
    [queryClient],
  );

  const signInWithGoogle: Auth["signInWithGoogle"] = useCallback(async (next, role) => {
    try {
      if (role) localStorage.setItem(PENDING_ROLE_KEY, role);
      else localStorage.removeItem(PENDING_ROLE_KEY);
    } catch {}
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect(next) } });
    readError(error);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    readError(error);
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: redirect("/dashboard") } });
    readError(error);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect("/reset-password") });
    readError(error);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    readError(error);
  }, []);

  const updateProfile: Auth["updateProfile"] = useCallback(
    async (patch) => {
      if (!uid) throw new Error("Sign in first");
      await updateMyProfile(uid, patch);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(uid) });
      // listings embed the seller's name/phone
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    [uid, queryClient],
  );

  const value: Auth = {
    ready: sessionReady && (!uid || !profile.isPending),
    user,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resendConfirmation,
    sendPasswordReset,
    updatePassword,
    updateProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
