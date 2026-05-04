import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Medal } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { RankBadge, getRank } from "@/components/Rank";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard - ChallengeX" }] }),
  component: Leaderboard,
});

interface Row {
  id: string;
  username: string | null;
  full_name: string | null;
  handle: string | null;
  total_points: number;
  avatar_url: string | null;
  challenges_done: number;
}

function Leaderboard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: users } = await supabase
        .from("users")
        .select("id, username, full_name, handle, total_points, avatar_url")
        .order("total_points", { ascending: false })
        .limit(100);
      const list = (users || []) as Omit<Row, "challenges_done">[];
      // Fetch completed counts in parallel
      const counts = await Promise.all(
        list.map((u) =>
          supabase
            .from("user_challenges")
            .select("*", { count: "exact", head: true })
            .eq("user_id", u.id)
            .eq("status", "completed"),
        ),
      );
      setRows(list.map((u, i) => ({ ...u, challenges_done: counts[i].count ?? 0 })));
      setLoading(false);
    })();
  }, [profile?.total_points]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-8 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">The climb is real.</p>
      </div>

      <div className="surface-card divide-y divide-border/40 overflow-hidden">
        {loading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
        {!loading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No players yet.</div>
        )}
        {rows.map((r, i) => {
          const isMe = r.id === profile?.id;
          const rank = getRank(r.total_points);
          const display = r.full_name || r.username || r.handle || "Player";
          return (
            <div
              key={r.id}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors"
              style={{
                backgroundColor: isMe
                  ? "color-mix(in oklab, var(--color-primary) 12%, transparent)"
                  : "transparent",
                borderLeft: isMe ? "2px solid var(--color-primary)" : "2px solid transparent",
              }}
            >
              <div className="w-10 shrink-0 text-center">
                {i < 3 ? (
                  <Medal
                    className="mx-auto h-6 w-6"
                    style={{
                      color: [
                        "var(--color-rank-gold)",
                        "var(--color-rank-silver)",
                        "var(--color-rank-bronze)",
                      ][i],
                    }}
                  />
                ) : (
                  <span className="font-display text-sm tabular text-muted-foreground">
                    #{i + 1}
                  </span>
                )}
              </div>
              <Avatar name={display} url={r.avatar_url} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold">{display}</span>
                  {isMe && (
                    <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      YOU
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {r.handle && <span>@{r.handle}</span>}
                  <RankBadge tier={rank.tier} size="sm" />
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-bold tabular">
                  {r.total_points.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.challenges_done} done
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  const initial = name?.[0]?.toUpperCase() || "?";
  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-muted font-display text-sm font-semibold">
      {initial}
    </div>
  );
}
