"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Tiny registry behind the full-screen loading screen. Anything heavy on the
 * first page (the 3D scroll scenes) registers a task; the loader stays up
 * until every task is done (or a time cap), so the page appears fully rendered
 * and shaders compile behind the loader instead of mid-scroll.
 */
type Task = { progress: number; done: boolean };

const tasks = new Set<Task>();
const listeners = new Set<() => void>();
let closed = false; // once the loader has gone, late tasks are ignored

const emit = () => listeners.forEach((fn) => fn());

export function subscribeLoader(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Overall progress 0..1 and whether every registered task has finished. */
export function loaderStatus() {
  if (tasks.size === 0) return { progress: 1, done: true };
  let sum = 0;
  let done = true;
  for (const t of tasks) {
    sum += t.done ? 1 : t.progress;
    done &&= t.done;
  }
  return { progress: sum / tasks.size, done };
}

export function closeLoader() {
  closed = true;
  tasks.clear();
}

export function isLoaderClosed() {
  return closed;
}

/**
 * Register a loading task for as long as the component is mounted and `pending` is true.
 * Returns a setter for its progress (0..1). The task completes when `pending` turns false.
 */
export function useLoaderTask(pending: boolean) {
  const task = useRef<Task | null>(null);

  // register on mount, before the loader checks for pending work
  useEffect(() => {
    if (closed) return;
    const t: Task = { progress: 0, done: false };
    task.current = t;
    tasks.add(t);
    emit();
    return () => {
      tasks.delete(t);
      task.current = null;
      emit();
    };
  }, []);

  useEffect(() => {
    const t = task.current;
    if (!t || pending || t.done) return;
    t.done = true;
    emit();
  }, [pending]);

  return useCallback((f: number) => {
    const t = task.current;
    if (!t || t.done) return;
    t.progress = Math.max(t.progress, Math.min(1, f));
    emit();
  }, []);
}
