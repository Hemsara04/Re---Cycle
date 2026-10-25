import type { Metadata } from "next";
import { Suspense } from "react";
import { PostForm } from "@/components/post/post-form";

export const metadata: Metadata = { title: "Post your waste" };

export default function PostPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 max-w-xl">
        <h1 className="font-heading text-4xl font-bold">Post your waste</h1>
        <p className="mt-2 text-muted-foreground">
          Cardboard sheets, glass bottles, old phones — if someone can reuse it, list it. It&apos;s free.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
        <PostForm />
      </Suspense>
    </div>
  );
}
