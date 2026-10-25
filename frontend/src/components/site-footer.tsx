import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-2">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            A free exchange for the plastic, glass and e-waste that the municipal truck won&apos;t take.
            Built in Sri Lanka, for Sri Lanka.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Explore</h3>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link href="/find" className="hover:text-foreground">Find materials</Link></li>
            <li><Link href="/post" className="hover:text-foreground">Post your waste</Link></li>
            <li><Link href="/signup" className="hover:text-foreground">Join as a collector</Link></li>
          </ul>
        </div>
        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Good to know</h3>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>Rinse bottles &amp; jars before handing over</li>
            <li>Keep e-waste batteries separate</li>
            <li>Meet in public places when possible</li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © 2026 Re-සයිකල් LK · Map data © OpenStreetMap contributors
      </div>
    </footer>
  );
}
