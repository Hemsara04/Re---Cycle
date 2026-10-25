import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      {/* three chasing arrows, simplified into leaf-like strokes */}
      <g fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-foreground">
        <path d="M11 20.5 8.2 15.6a2 2 0 0 1 0-2l3.3-5.7a2 2 0 0 1 3.4 0l1.4 2.4" />
        <path d="m19.6 10.6 4.3 7.4a2 2 0 0 1-1.7 3H18" />
        <path d="M14.3 21H9.8" />
        <path d="m17.4 8.4-.6 2.6-2.6-.6M21 23l-3-2 2-2.8M11.6 18.6 11 21l2.6.7" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-heading text-lg leading-none font-bold tracking-tight">
        Re-<span className="text-primary">සයිකල්</span>
        <span className="ml-1 rounded-md bg-foreground px-1 py-0.5 align-middle text-[0.65rem] font-semibold text-background">
          LK
        </span>
      </span>
    </span>
  );
}
