"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/find", label: "Find what you want" },
  { href: "/post", label: "Post your waste" },
];

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user: currentUser, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="site-header sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg transition-[translate,opacity] duration-500 ease-out">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" aria-label="Re-සයිකල් LK home">
          <Logo />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                isActive(n.href) && "bg-secondary text-secondary-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Link href="/post" className={cn(buttonVariants({ size: "lg" }), "hidden px-3 sm:inline-flex")}>
            <PlusIcon /> Post waste
          </Link>

          {currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="Account menu"
              >
                <Avatar>
                  <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                    {initials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="font-medium text-foreground">{currentUser.name}</div>
                    <div className="text-xs capitalize">{currentUser.role}</div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                  <LayoutDashboardIcon /> My dashboard
                </DropdownMenuItem>
                {currentUser.role === "admin" && (
                  <DropdownMenuItem onClick={() => router.push("/admin")}>
                    <ShieldCheckIcon /> Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => signOut().then(() => router.push("/"))}
                >
                  <LogOutIcon /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "hidden md:inline-flex")}>
              Sign in
            </Link>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}>
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {[...NAV, ...(currentUser ? [{ href: "/dashboard", label: "My dashboard" }] : [])].map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2.5 font-medium",
                      isActive(n.href) ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {n.label}
                  </Link>
                ))}
                {currentUser?.role === "admin" && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 font-medium text-muted-foreground">
                    Admin
                  </Link>
                )}
                {!currentUser && (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ size: "lg" }), "mt-4 h-10")}
                  >
                    Sign in
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
