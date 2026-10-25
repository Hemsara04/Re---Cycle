"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2Icon, FactoryIcon, HomeIcon, LoaderCircleIcon, MailCheckIcon, TruckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { isValidPhone } from "@/lib/phone";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type SignupRole = Exclude<Role, "admin">;

const ROLES: { id: SignupRole; label: string; hint: string; icon: typeof HomeIcon }[] = [
  { id: "seller", label: "Seller", hint: "I have waste to give away", icon: HomeIcon },
  { id: "collector", label: "Collector", hint: "I pick up and resell", icon: TruckIcon },
  { id: "business", label: "Business", hint: "Shop, hotel or office", icon: Building2Icon },
  { id: "recycler", label: "Recycler", hint: "I process materials", icon: FactoryIcon },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

function useNext() {
  const params = useSearchParams();
  const next = params.get("next");
  return next?.startsWith("/") ? next : "/dashboard";
}

/** Signed-in visitors don't need these pages. */
function useRedirectIfSignedIn(next: string) {
  const { ready, user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);
}

function GoogleButton({ label, next, role }: { label: string; next: string; role?: SignupRole }) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-11 w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signInWithGoogle(next, role); // navigates away on success
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {busy ? <LoaderCircleIcon className="animate-spin" /> : <GoogleIcon />} {label}
    </Button>
  );
}

const Or = ({ children = "or" }: { children?: string }) => (
  <div className="flex items-center gap-3 text-xs text-muted-foreground">
    <Separator className="flex-1" /> {children} <Separator className="flex-1" />
  </div>
);

export function LoginForm() {
  const router = useRouter();
  const next = useNext();
  const { signIn, sendPasswordReset, resendConfirmation } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  useRedirectIfSignedIn(next);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setUnconfirmed(false);
    try {
      const profile = await signIn(email, password);
      toast.success(`Welcome back${profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}`);
      router.push(profile?.role === "admin" && next === "/dashboard" ? "/admin" : next);
    } catch (err) {
      const msg = (err as Error).message;
      if (/confirm your email/i.test(msg)) setUnconfirmed(true);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-heading text-3xl">Welcome back</CardTitle>
        <CardDescription>Sign in to post listings and claim materials.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GoogleButton label="Continue with Google" next={next} />
        <Or />
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={async () => {
                  if (!email) return toast("Enter your email first, then tap “Forgot password?”");
                  try {
                    await sendPasswordReset(email);
                    toast.success("Check your inbox for a reset link.");
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              >
                Forgot password?
              </button>
            </div>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
          </div>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
            {busy && <LoaderCircleIcon className="animate-spin" />} Sign in
          </Button>
        </form>
        {unconfirmed && (
          <Button
            variant="link"
            className="w-full"
            onClick={() => resendConfirmation(email).then(() => toast.success("Confirmation email sent again."), (e: Error) => toast.error(e.message))}
          >
            Resend confirmation email
          </Button>
        )}
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        New here?&nbsp;
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </CardFooter>
    </Card>
  );
}

export function SignupForm() {
  const router = useRouter();
  const next = useNext();
  const { signUp, resendConfirmation } = useAuth();
  const [role, setRole] = useState<SignupRole>("seller");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  useRedirectIfSignedIn(next);

  const phoneOk = isValidPhone(phone);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneOk) return toast.error("Enter a Sri Lankan mobile number", { description: "e.g. 077 123 4567 — used for WhatsApp." });
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({ name, email, phone, password, role }, next);
      if (needsConfirmation) setSentTo(email.trim());
      else {
        toast.success("Account created");
        router.push(next);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <MailCheckIcon className="mx-auto size-10 text-primary" />
          <CardTitle className="font-heading text-3xl">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Open it on this device to finish
            signing up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {(role === "business" || role === "recycler") && <p>Business and recycler accounts are reviewed by an admin before you can post.</p>}
          <Button
            variant="link"
            onClick={() => resendConfirmation(sentTo).then(() => toast.success("Sent again."), (e: Error) => toast.error(e.message))}
          >
            Didn&apos;t get it? Send again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="font-heading text-3xl">Join Re-සයිකල් LK</CardTitle>
        <CardDescription>Free for everyone. Pick the role that fits you best.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={role === r.id}
              onClick={() => setRole(r.id)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                role === r.id ? "border-primary bg-secondary" : "hover:bg-muted",
              )}
            >
              <r.icon className={cn("mt-0.5 size-4 shrink-0", role === r.id ? "text-primary" : "text-muted-foreground")} />
              <span>
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.hint}</span>
              </span>
            </button>
          ))}
        </div>
        {(role === "business" || role === "recycler") && (
          <p className="text-xs text-muted-foreground">Business and recycler accounts are reviewed by an admin before going live.</p>
        )}

        <GoogleButton label="Sign up with Google" next={next} role={role} />
        <Or>or with email</Or>

        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">{role === "business" || role === "recycler" ? "Business name" : "Full name"}</Label>
            <Input id="name" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">WhatsApp number</Label>
            <Input
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="077 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={phone.length > 5 && !phoneOk}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
            />
          </div>
          <Button type="submit" size="lg" className="h-11 sm:col-span-2" disabled={busy}>
            {busy && <LoaderCircleIcon className="animate-spin" />} Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

/** Landing page of the password-reset email link. */
export function ResetPasswordForm() {
  const router = useRouter();
  const { ready, user, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) return <div className="h-64 w-full max-w-md animate-pulse rounded-3xl bg-muted" />;
  if (!user) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Link expired</CardTitle>
          <CardDescription>Request a new reset link from the sign-in page.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-heading text-3xl">Choose a new password</CardTitle>
        <CardDescription>For {user.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 8) return toast.error("Password must be at least 8 characters");
            setBusy(true);
            try {
              await updatePassword(password);
              toast.success("Password updated");
              router.push("/dashboard");
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
            {busy && <LoaderCircleIcon className="animate-spin" />} Save password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
