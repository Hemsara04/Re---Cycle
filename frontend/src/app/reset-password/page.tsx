import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="flex justify-center bg-[radial-gradient(ellipse_at_top,var(--color-secondary),transparent_60%)] px-4 py-16">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
