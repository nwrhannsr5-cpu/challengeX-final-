import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { ProgressBar, RankBadge, getRank } from "@/components/Rank";
import { Footprints, Flame, Apple, Droplet, Pencil } from "lucide-react";
import { supabase, type ActivityLog } from "@/lib/supabase";
import { healthImages } from "@/lib/visuals";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - ChallengeX" }] }),
  component: Profile,
});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function streakFromLogs(logs: ActivityLog[]) {
  const days = new Set(logs.map((l) => l.created_at.slice(0, 10)));
  let s = 0;
  const cur = new Date();
  if (!days.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
  while (days.has(cur.toISOString().slice(0, 10))) {
    s++;
    cur.setDate(cur.getDate() - 1);
  }
  return s;
}

function Profile() {
  const { profile, user, signOut } = useAuth();
  const [done, setDone] = useState(0);
  const [streak, setStreak] = useState(0);
  const [today, setToday] = useState<{
    steps: number;
    calories: number;
    protein: number;
    water: number;
  }>({
    steps: 0,
    calories: 0,
    protein: 0,
    water: 0,
  });

  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateGoal = async (currentValue: number, key: keyof typeof today) => {
    if (!profile) return;
    const num = Number(editValue);
    if (isNaN(num) || num < 0) return;
    setIsUpdating(true);

    const diff = num - currentValue;
    if (diff !== 0) {
      const { error } = await supabase.from("activity_log").insert({
        user_id: profile.id,
        action: "manual_update",
        metadata: { [key]: diff },
      });
      if (!error) {
        setToday((prev) => ({ ...prev, [key]: num }));
      } else {
        console.error("Failed to insert activity_log:", error);
      }
    }
    setEditingGoal(null);
    setEditValue("");
    setIsUpdating(false);
  };

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ count }, { data: logs }] = await Promise.all([
        supabase
          .from("user_challenges")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("status", "completed"),
        supabase
          .from("activity_log")
          .select("*")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      setDone(count ?? 0);
      const arr = (logs as ActivityLog[]) ?? [];
      setStreak(streakFromLogs(arr));

      const tk = todayKey();
      const todays = arr.filter((l) => l.created_at.slice(0, 10) === tk);
      const sums = { steps: 0, calories: 0, protein: 0, water: 0 };
      todays.forEach((l) => {
        const m = (l.metadata || {}) as Record<string, unknown>;
        sums.steps += Number(m.steps ?? 0) || 0;
        sums.calories += Number(m.calories ?? 0) || 0;
        sums.protein += Number(m.protein ?? 0) || 0;
        sums.water += Number(m.water ?? 0) || 0;
      });
      setToday(sums);
    })();
  }, [profile]);

  if (!profile) return null;
  const rank = getRank(profile.total_points);
  const display = profile.full_name || profile.username || "Player";
  const heightM = (profile.height_cm ?? 0) / 100;
  const bmi = profile.weight_kg && heightM > 0 ? profile.weight_kg / (heightM * heightM) : null;

  const goals = [
    {
      label: "Steps",
      key: "steps" as const,
      icon: Footprints,
      value: today.steps,
      target: 10000,
      color: "var(--primary)",
    },
    {
      label: "Calories",
      key: "calories" as const,
      icon: Flame,
      value: today.calories,
      target: profile.calorie_goal ?? 2200,
      color: "var(--streak)",
    },
    {
      label: "Protein (g)",
      key: "protein" as const,
      icon: Apple,
      value: today.protein,
      target: 120,
      color: "var(--secondary)",
    },
    {
      label: "Water (L)",
      key: "water" as const,
      icon: Droplet,
      value: today.water,
      target: 2.5,
      color: "var(--rank-platinum)",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <div className="surface-card relative overflow-hidden p-4 md:p-7">
        <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr] md:items-center">
          <div className="flex flex-wrap items-center gap-6">
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary font-display text-3xl font-bold text-primary-foreground">
              {display[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-bold">{display}</h1>
                <RankBadge tier={rank.tier} />
              </div>
              <p className="text-sm text-muted-foreground">
                {profile.handle ? `@${profile.handle} - ` : ""}
                {user?.email}
              </p>
            </div>
            <div className="text-left md:text-right">
              <div className="font-display text-3xl font-bold tabular text-primary">
                {profile.total_points.toLocaleString()}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Points</div>
            </div>
          </div>

          <img
            src={healthImages.wellness}
            alt="Fresh vegetables prepared for a healthy meal"
            className="health-photo h-44 w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Vital label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : "-"} />
        <Vital label="Weight" value={profile.weight_kg ? `${profile.weight_kg} kg` : "-"} />
        <Vital label="BMI" value={bmi ? bmi.toFixed(1) : "-"} />
        <Vital
          label="Calorie goal"
          value={profile.calorie_goal ? `${profile.calorie_goal}` : "-"}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Vital label="Streak" value={`${streak} days`} />
        <Vital label="Challenges done" value={done.toString()} />
        <Vital label="Rank" value={rank.tier} />
      </div>

      <div className="surface-card p-6">
        <h3 className="mb-5 font-display font-semibold">Today's goals</h3>
        <div className="space-y-5">
          {goals.map((g) => (
            <div key={g.label}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <g.icon className="h-3.5 w-3.5" style={{ color: g.color }} />
                  {g.label}
                </span>
                <span className="tabular text-muted-foreground flex items-center gap-3">
                  {editingGoal === g.label ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="control-input h-7 w-20 px-2 py-0.5 text-xs"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        disabled={isUpdating}
                      />
                      <button
                        onClick={() => handleUpdateGoal(g.value, g.key)}
                        disabled={isUpdating}
                        className="primary-button h-7 px-3 py-0 text-xs shadow-none"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingGoal(null)}
                        disabled={isUpdating}
                        className="text-xs hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>
                        {g.value} / {g.target}
                      </span>
                      <button
                        onClick={() => {
                          setEditingGoal(g.label);
                          setEditValue(g.value.toString());
                        }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Edit progress"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </span>
              </div>
              <ProgressBar value={g.target ? g.value / g.target : 0} color={g.color} />
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Daily goals aggregate from your activity_log entries (metadata fields: steps, calories,
          protein, water).
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => signOut()}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold tabular">{value}</div>
    </div>
  );
}
