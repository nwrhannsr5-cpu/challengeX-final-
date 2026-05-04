import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Flame, Trophy, Target, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase, type ActivityLog } from "@/lib/supabase";
import { healthImages } from "@/lib/visuals";
import { RankBadge, ProgressBar, getRank } from "@/components/Rank";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard - ChallengeX" }] }),
  component: Dashboard,
});

const HEATMAP_WEEKS = 17;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeStreak(logs: ActivityLog[]): number {
  const days = new Set(logs.map((l) => l.created_at.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  // tolerate today empty
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildHeatmap(logs: ActivityLog[]) {
  const counts = new Map<string, number>();
  logs.forEach((l) => {
    const k = l.created_at.slice(0, 10);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  const cells: { date: string; count: number }[] = [];
  const today = new Date();
  // align to Sunday end
  const totalDays = HEATMAP_WEEKS * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - (totalDays - 1));
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = dayKey(d);
    cells.push({ date: k, count: counts.get(k) ?? 0 });
  }
  return cells;
}

function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ done: 0, streak: 0, roomsWon: 0, globalRank: 0 });
  const [cells, setCells] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ count: done }, { count: better }, { data: logs }, { count: roomsWon }] =
        await Promise.all([
          supabase
            .from("user_challenges")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id)
            .eq("status", "completed"),
          supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .gt("total_points", profile.total_points),
          supabase
            .from("activity_log")
            .select("*")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("rooms")
            .select("*", { count: "exact", head: true })
            .eq("created_by", profile.id)
            .eq("status", "completed"),
        ]);
      const logArr = (logs as ActivityLog[]) ?? [];
      setCells(buildHeatmap(logArr));
      setStats({
        done: done ?? 0,
        globalRank: (better ?? 0) + 1,
        streak: computeStreak(logArr),
        roomsWon: roomsWon ?? 0,
      });
    })();
  }, [profile]);

  if (!profile) return null;
  const rank = getRank(profile.total_points);
  const displayName = profile.full_name || profile.username || "Challenger";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <Header name={displayName} />

      <div className="surface-card relative overflow-hidden p-4 md:p-7">
        <div className="grid gap-6 md:grid-cols-[1.05fr_0.95fr] md:items-stretch">
          <div className="flex flex-col justify-between">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Crown className="h-3.5 w-3.5" /> Current Rank
            </div>
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl font-bold">{displayName}</h1>
                <RankBadge tier={rank.tier} />
              </div>
              <p className="text-sm text-muted-foreground">
                Global rank{" "}
                <span className="font-display font-semibold text-foreground">
                  #{stats.globalRank}
                </span>
                {profile.handle && (
                  <span className="ml-3 text-muted-foreground">@{profile.handle}</span>
                )}
              </p>
            </div>

            <div className="mt-8">
              <div className="font-display text-5xl font-bold tabular text-primary">
                {profile.total_points.toLocaleString()}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Total points
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>{rank.tier}</span>
                <span>
                  {rank.next ? `${rank.next - profile.total_points} pts to next tier` : "Max tier"}
                </span>
              </div>
              <ProgressBar value={rank.progress} height={8} />
            </div>
          </div>

          <div className="relative min-h-56 overflow-hidden rounded-[12px]">
            <img
              src={healthImages.dashboard}
              alt="A healthy breakfast bowl"
              className="h-full min-h-56 w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-4 text-white">
              <p className="text-xs uppercase tracking-widest text-white/80">Today's focus</p>
              <p className="font-display text-xl font-bold">Eat well. Move often. Recover.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          icon={Trophy}
          label="Total Points"
          value={profile.total_points.toLocaleString()}
          color="var(--color-primary)"
        />
        <Stat
          icon={Target}
          label="Challenges Done"
          value={stats.done.toString()}
          color="var(--color-secondary)"
        />
        <Stat
          icon={Flame}
          label="Day Streak"
          value={`${stats.streak} days`}
          color="var(--color-streak)"
        />
        <Stat
          icon={Crown}
          label="Rooms Won"
          value={stats.roomsWon.toString()}
          color="var(--color-rank-gold)"
        />
      </div>

      <div className="surface-card grid gap-6 p-6 md:grid-cols-[0.7fr_1.3fr]">
        <img
          src={healthImages.activity}
          alt="A person running outdoors"
          className="health-photo h-48 w-full md:h-full"
        />
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-semibold">Activity</h3>
            <span className="text-xs text-muted-foreground">Last {HEATMAP_WEEKS} weeks</span>
          </div>
          <Heatmap cells={cells} />
        </div>
      </div>
    </div>
  );
}

function Header({ name }: { name: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{greeting}</p>
        <h2 className="font-display text-xl font-semibold">Ready to climb, {name}?</h2>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="surface-card p-5">
      <div
        className="mb-3 grid h-9 w-9 place-items-center rounded-[8px]"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="font-display text-2xl font-bold tabular">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Heatmap({ cells }: { cells: { date: string; count: number }[] }) {
  // bucket counts to opacity levels
  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n < 4 ? 2 : 3);
  const opacity = [0.06, 0.3, 0.6, 0.95];
  const cols = HEATMAP_WEEKS;
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: cols }).map((_, c) => (
        <div key={c} className="flex flex-col gap-[3px]">
          {Array.from({ length: 7 }).map((_, r) => {
            const cell = cells[c * 7 + r];
            if (!cell) return <div key={r} className="h-[14px] w-[14px]" />;
            const o = opacity[level(cell.count)];
            return (
              <div
                key={r}
                title={`${cell.date}: ${cell.count}`}
                className="h-[14px] w-[14px] rounded-[3px]"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--color-primary) ${o * 100}%, var(--color-muted))`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
