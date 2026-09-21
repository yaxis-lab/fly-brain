"use client";

import { cn } from "@/utils/cn";
import { Activity, Home, Network, Waypoints, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

const navs: readonly NavigationItem[] = [
  {
    label: "Home",
    href: "/",
    icon: Home,
    disabled: false,
  },
  {
    label: "Connectome",
    href: "/connectome",
    icon: Network,
    disabled: true,
  },
  {
    label: "Neurons",
    href: "/neurons",
    icon: Waypoints,
    disabled: true,
  },
  {
    label: "Simulations",
    href: "/simulations",
    icon: Activity,
    disabled: false,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "group/sidebar fixed inset-y-0 left-0 z-50",
        "border-r border-zinc-200 bg-[#f7f7f5]",
        "transition-[width] duration-200",
        "w-17 hover:w-64",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b border-zinc-200 px-3">
          <Link
            href="/"
            className="flex w-full min-w-0 items-center gap-3 rounded-md px-1.5 py-1.5 transition-colors hover:bg-zinc-200/60"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white">
              <span className="text-sm font-semibold text-zinc-800">F</span>
            </div>

            <div
              className={cn(
                "min-w-0 overflow-hidden whitespace-nowrap",
                "transition-[width,opacity] duration-150",
                "w-0 opacity-0 group-hover/sidebar:w-auto group-hover/sidebar:opacity-100",
              )}
            >
              <p className="text-[17px] leading-none text-zinc-800">FlyBrain</p>
              <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                CNS Explorer
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3">
          {navs.map((nav) => {
            const Icon = nav.icon;
            const isActive =
              !nav.disabled &&
              (nav.href === "/" ? pathname === "/" : pathname.startsWith(nav.href));

            return (
              <Link
                key={nav.href}
                href={nav.disabled ? "#" : nav.href}
                aria-disabled={nav.disabled || undefined}
                tabIndex={nav.disabled ? -1 : undefined}
                className={cn(
                  "group/nav flex h-10 w-full items-center",
                  "rounded-md px-1.5",
                  "text-sm font-medium text-zinc-600",
                  "transition-colors",
                  "hover:bg-zinc-200/60 hover:text-zinc-900",
                  isActive && "bg-zinc-200/70 text-zinc-950",
                  "justify-start gap-3",
                  nav.disabled &&
                    "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-zinc-600",
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center">
                  <Icon
                    size={17}
                    strokeWidth={1.7}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                </div>

                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap",
                    "transition-[width,opacity] duration-150",
                    "w-0 opacity-0 group-hover/sidebar:w-auto group-hover/sidebar:opacity-100",
                  )}
                >
                  {nav.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
