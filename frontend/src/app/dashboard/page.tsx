import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = { title: "My dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
        <DashboardView />
      </Suspense>
    </div>
  );
}
