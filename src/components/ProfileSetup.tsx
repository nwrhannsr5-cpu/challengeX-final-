import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { healthImages } from "@/lib/visuals";
import { useNavigate } from "@tanstack/react-router";

function getProfileSaveError(error: unknown) {
  const maybeError = error as { message?: unknown; details?: unknown; hint?: unknown };
  const message =
    error instanceof Error
      ? error.message
      : typeof maybeError?.message === "string"
        ? maybeError.message
        : "";
  const details = typeof maybeError?.details === "string" ? maybeError.details : "";
  const hint = typeof maybeError?.hint === "string" ? maybeError.hint : "";
  const raw = [message, details, hint].filter(Boolean).join(" ");

  if (
    raw.includes("Could not find the table") ||
    raw.includes('relation "public.users" does not exist') ||
    raw.includes("schema cache")
  ) {
    return "Database is not set up yet. Run SUPABASE_SETUP.sql in Supabase SQL Editor, then try again.";
  }

  if (raw.includes("users_handle_unique") || raw.includes("duplicate key value")) {
    return "This handle is already taken. Try another one.";
  }

  if (raw.includes('null value in column "name"')) {
    return "Your users table needs the latest setup SQL. Run SUPABASE_SETUP.sql again, then retry.";
  }

  if (raw.includes("row-level security") || raw.includes("violates row-level security")) {
    return "Supabase blocked this save. Run the latest SUPABASE_SETUP.sql file, then try again.";
  }

  return raw || "Could not save profile. Check Supabase setup and try again.";
}

export function ProfileSetup() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [handle, setHandle] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [calorieGoal, setCalorieGoal] = useState("2200");

  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErr(null);
    setSuccess(false);
    setBusy(true);

    const cleanFullName = fullName.trim();
    const cleanHandle = handle.replace(/^@/, "").trim().toLowerCase();
    const heightValue = Number(height);
    const weightValue = Number(weight);
    const calorieGoalValue = Number(calorieGoal);

    if (!cleanFullName || !cleanHandle || !height || !weight) {
      setErr("Fill in full name, handle, height, and weight first.");
      setBusy(false);
      return;
    }

    if (
      !Number.isFinite(heightValue) ||
      !Number.isFinite(weightValue) ||
      !Number.isFinite(calorieGoalValue) ||
      heightValue <= 0 ||
      weightValue <= 0 ||
      calorieGoalValue <= 0
    ) {
      setErr("Height, weight, and calorie goal must be positive numbers.");
      setBusy(false);
      return;
    }

    try {
      const { error } = await supabase.from("users").upsert({
        id: user.id,
        email: user.email ?? null,
        name: cleanFullName,
        full_name: cleanFullName,
        handle: cleanHandle,
        username: cleanHandle,
        height_cm: heightValue,
        weight_kg: weightValue,
        calorie_goal: calorieGoalValue,
        profile_completed: true,
      });

      if (error) throw error;

      await refreshProfile();
      setSuccess(true);

      setTimeout(() => {
        navigate({ to: "/challenges" });
      }, 1000);
    } catch (e: unknown) {
      setErr(getProfileSaveError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-[1.05fr_0.95fr]">
        <div className="surface-card overflow-hidden p-3">
          <img
            src={healthImages.profile}
            alt="A calm outdoor wellness moment"
            className="health-photo h-56 w-full md:h-[560px]"
          />
          <div className="px-2 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Your baseline</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Start with simple numbers.</h2>
          </div>
        </div>

        <div>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 1 of 1</p>
            <h1 className="mt-1 font-display text-3xl font-bold">Set up your profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We use this to personalize your dashboard and ranking.
            </p>
          </div>

          <form noValidate onSubmit={submit} className="surface-card space-y-4 p-6">
            <Field
              label="Full name"
              value={fullName}
              onChange={setFullName}
              placeholder="Alex Carter"
            />
            <Field
              label="Handle"
              value={handle}
              onChange={setHandle}
              placeholder="alex"
              prefix="@"
            />

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Height (cm)"
                type="number"
                value={height}
                onChange={setHeight}
                placeholder="175"
              />
              <Field
                label="Weight (kg)"
                type="number"
                value={weight}
                onChange={setWeight}
                placeholder="72"
              />
            </div>

            <Field
              label="Daily calorie goal"
              type="number"
              value={calorieGoal}
              onChange={setCalorieGoal}
            />

            {err && (
              <p className="text-xs text-red-500" role="alert">
                {err}
              </p>
            )}
            {success && (
              <p className="text-xs text-green-700" role="status">
                Profile saved successfully!
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-[10px] bg-primary py-2.5 font-display font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Start competing"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <div
        className="flex items-center rounded-[10px] bg-muted focus-within:shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-primary)_32%,transparent)]"
        style={{ border: "0.5px solid var(--color-border)" }}
      >
        {prefix && <span className="pl-3 text-sm text-muted-foreground">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="w-full bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </label>
  );
}
