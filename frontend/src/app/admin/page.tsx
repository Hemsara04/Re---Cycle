import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminView } from "@/components/admin/admin-view";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
        <AdminView />
      </Suspense>
    </div>
  );
}
