import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Sidebar } from "@/components/Sidebar";
import { GlobalThemeToggle } from "@/components/GlobalThemeToggle";
import { LoginScreen } from "@/components/LoginScreen";
import { ProfileSetup } from "@/components/ProfileSetup";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ChallengeX - Compete. Conquer. Climb." },
      {
        name: "description",
        content: "Compete in health challenges, earn points, and climb the global ranks.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: () => (
    <ThemeProvider>
      <AuthProvider>
        <GlobalThemeToggle />
        <AppGate />
      </AuthProvider>
    </ThemeProvider>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppGate() {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <div className="font-display text-sm">Loading...</div>
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  if (!profile?.profile_completed) return <ProfileSetup />;
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-16 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
