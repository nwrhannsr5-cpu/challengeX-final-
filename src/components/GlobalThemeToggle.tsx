import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme";

export function GlobalThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-5 top-5 z-[80] grid h-11 w-11 place-items-center rounded-full border border-border bg-card/90 text-foreground shadow-xl backdrop-blur transition-all duration-300 hover:scale-105 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
