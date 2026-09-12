import { Home, Network, Settings, Waypoints } from "lucide-react";
import Link from "next/link";

interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly icon: typeof Home;
  readonly disabled?: boolean;
}

const primaryNavigation: readonly NavigationItem[] = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
];

const analysisNavigation: readonly NavigationItem[] = [
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
];

interface SidebarProps {
  readonly currentPath?: string;
}

export function Sidebar({ currentPath = "/" }: SidebarProps) {
  return (
    <aside
      className="
        flex h-dvh w-64 shrink-0 flex-col
        border-r border-zinc-200/80
        bg-zinc-50/80
        text-zinc-900
      "
    >
      {/* Brand */}
      <div className="flex h-16 items-center px-5">
        <Link
          href="/"
          className="
            flex items-center gap-3
            rounded-lg
            outline-none
            focus-visible:ring-2
            focus-visible:ring-zinc-400
          "
          aria-label="FlyBrain home"
        >
          <div
            className="
              flex size-8 items-center justify-center
              rounded-lg
              bg-zinc-900
              text-white
            "
            aria-hidden="true"
          >
            <span className="text-sm font-semibold">F</span>
          </div>

          <div className="leading-none">
            <p className="text-sm font-semibold tracking-tight">FlyBrain</p>

            <p className="mt-1 text-[11px] font-medium text-zinc-500">
              CNS Explorer
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-5"
        aria-label="Main navigation"
      >
        <NavigationSection
          label="Explore"
          items={primaryNavigation}
          currentPath={currentPath}
        />

        <NavigationSection
          label="Analysis"
          items={analysisNavigation}
          currentPath={currentPath}
        />
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-200/80 p-3">
        <a
          href="/settings"
          className="
            flex items-center gap-3
            rounded-lg px-3 py-2.5
            text-sm font-medium text-zinc-600
            transition-colors
            hover:bg-zinc-200/60
            hover:text-zinc-900
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-zinc-400
          "
        >
          <Settings className="size-4" strokeWidth={1.8} aria-hidden="true" />

          <span>Settings</span>
        </a>

        <div
          className="
            mt-3 rounded-lg
            border border-zinc-200
            bg-white
            px-3 py-2.5
          "
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Dataset
          </p>

          <p className="mt-1 text-xs font-medium text-zinc-700">Male CNS</p>

          <p className="mt-0.5 text-[11px] text-zinc-400">v1.0</p>
        </div>
      </div>
    </aside>
  );
}

interface NavigationSectionProps {
  readonly label: string;
  readonly items: readonly NavigationItem[];
  readonly currentPath: string;
}

function NavigationSection({
  label,
  items,
  currentPath,
}: NavigationSectionProps) {
  return (
    <section className="mb-7">
      <h2
        className="
          mb-2 px-3
          text-[10px] font-semibold
          uppercase tracking-[0.12em]
          text-zinc-400
        "
      >
        {label}
      </h2>

      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === currentPath;

          return (
            <li key={item.href}>
              <a
                href={item.disabled ? undefined : item.href}
                aria-current={isActive ? "page" : undefined}
                aria-disabled={item.disabled || undefined}
                tabIndex={item.disabled ? -1 : undefined}
                className={`
                  flex items-center gap-3
                  rounded-lg px-3 py-2.5
                  text-sm font-medium
                  transition-colors
                  outline-none
                  focus-visible:ring-2
                  focus-visible:ring-zinc-400
                  ${
                    isActive
                      ? "bg-zinc-200/80 text-zinc-950"
                      : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900"
                  }
                  ${item.disabled ? "pointer-events-none opacity-40" : ""}
                `}
              >
                <Icon
                  className="size-4 shrink-0"
                  strokeWidth={isActive ? 2 : 1.8}
                  aria-hidden="true"
                />

                <span>{item.label}</span>

                {item.disabled && (
                  <span
                    className="
                      ml-auto
                      text-[9px] font-medium
                      uppercase tracking-wider
                      text-zinc-400
                    "
                  >
                    Soon
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
