import type { Metadata } from "next";
import { Suspense } from "react";
import { FindView } from "@/components/find/find-view";

export const metadata: Metadata = { title: "Find what you want" };

export default function FindPage() {
  return (
    <Suspense>
      <FindView />
    </Suspense>
  );
}
