import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { healthImages } from "@/lib/visuals";

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") await signIn(email, password);
      else await signUp(email, password);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-[0.95fr_1.05fr]">
        <div className="w-full">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[10px] bg-primary font-display text-xl font-bold text-primary-foreground">
              X
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">ChallengeX</h1>
              <p className="text-xs text-muted-foreground">Healthy challenges, real progress.</p>
            </div>
          </div>

          <div className="surface-card p-6">
            <div className="mb-5 flex gap-1 rounded-[8px] bg-muted p-1 text-sm">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 rounded-[6px] px-3 py-1.5 font-medium transition-colors"
                  style={{
                    backgroundColor: mode === m ? "var(--color-primary)" : "transparent",
                    color:
                      mode === m
                        ? "var(--color-primary-foreground)"
                        : "var(--color-muted-foreground)",
                  }}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@email.com"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Password"
              />

              {err && <p className="text-xs text-destructive">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 w-full rounded-[10px] bg-primary py-2.5 font-display font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Saving..." : mode === "login" ? "Enter ChallengeX" : "Create account"}
              </button>
            </form>
          </div>
        </div>

        <div className="hidden md:block">
          <div className="surface-card overflow-hidden p-3">
            <img
              src={healthImages.login}
              alt="Fresh vegetables and a healthy meal"
              className="health-photo h-[560px] w-full"
            />
            <div className="px-2 py-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Wellness Arena
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">
                Small daily wins, cleaner habits.
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-[10px] bg-muted px-3 py-2.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-primary)_32%,transparent)]"
        style={{ border: "0.5px solid var(--color-border)" }}
      />
    </label>
  );
}
