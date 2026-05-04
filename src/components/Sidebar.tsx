import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Trophy, Medal, Users, User, LogOut, Newspaper } from "lucide-react";
import { useAuth } from "@/lib/auth";

const items = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/challenges", icon: Trophy, label: "Challenges" },
  { to: "/leaderboard", icon: Medal, label: "Leaderboard" },
  { to: "/rooms", icon: Users, label: "Rooms" },
  { to: "/feed", icon: Newspaper, label: "Feed" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut } = useAuth();

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-16 flex-col items-center justify-between py-5"
      style={{
        backgroundColor: "var(--color-sidebar)",
        borderRight: "0.5px solid var(--color-sidebar-border)",
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-[10px] bg-primary font-display text-lg font-bold text-primary-foreground">
          X
        </div>
        {items.map(({ to, icon: Icon, label }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              title={label}
              className="group relative grid h-11 w-11 place-items-center rounded-[10px] transition-colors"
              style={{
                color: active
                  ? "var(--color-primary-foreground)"
                  : "var(--color-sidebar-foreground)",
                backgroundColor: active ? "var(--color-primary)" : "transparent",
              }}
            >
              {active && (
                <span className="absolute -left-2 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>
      <button
        onClick={() => signOut()}
        title="Sign out"
        className="grid h-11 w-11 place-items-center rounded-[10px] text-sidebar-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </aside>
  );
}
