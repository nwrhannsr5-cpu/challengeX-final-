import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Dumbbell, Footprints, Apple, Moon, Droplet, Heart, Check, Play } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase, type Challenge, type UserChallenge } from "@/lib/supabase";
import { challengeImage } from "@/lib/visuals";
import { ProgressBar } from "@/components/Rank";
import { RewardModal } from "@/components/RewardModal";

export const Route = createFileRoute("/challenges")({
  head: () => ({ meta: [{ title: "Challenges - ChallengeX" }] }),
  component: ChallengesPage,
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  apple: Apple,
  moon: Moon,
  droplet: Droplet,
  heart: Heart,
};

function pickIcon(c: Challenge) {
  return ICONS[(c.icon || "").toLowerCase()] || Dumbbell;
}

function ChallengesPage() {
  const { profile, refreshProfile } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [mine, setMine] = useState<Record<string, UserChallenge>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState<Challenge | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("challenges")
      .select("*")
      .order("points_reward", { ascending: true });
    setChallenges((data as Challenge[]) || []);
    if (profile) {
      const { data: ucs } = await supabase
        .from("user_challenges")
        .select("*")
        .eq("user_id", profile.id);
      const map: Record<string, UserChallenge> = {};
      (ucs || []).forEach((u) => {
        map[(u as UserChallenge).challenge_id] = u as UserChallenge;
      });
      setMine(map);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const start = async (c: Challenge) => {
    if (!profile) return;
    setBusy(c.id);
    try {
      await supabase.from("user_challenges").upsert(
        {
          user_id: profile.id,
          challenge_id: c.id,
          status: "in_progress",
          progress: 0,
          progress_count: 0,
        },
        { onConflict: "user_id,challenge_id" },
      );
      await supabase.from("activity_log").insert({
        user_id: profile.id,
        action: "started_challenge",
        points: 0,
        metadata: { challenge_id: c.id, title: c.title },
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const markProgress = async (c: Challenge) => {
    if (!profile) return;
    setBusy(c.id);
    try {
      const uc = mine[c.id];
      const currentCount = uc?.progress_count || 0;
      const totalDays = c.total_days || 7;
      const nextCount = currentCount + 1;
      const isComplete = nextCount >= totalDays;
      const progressPercent = Math.min(100, Math.floor((nextCount / totalDays) * 100));

      await supabase.from("user_challenges").upsert(
        {
          user_id: profile.id,
          challenge_id: c.id,
          status: isComplete ? "completed" : "in_progress",
          progress: isComplete ? 100 : progressPercent,
          progress_count: nextCount,
          completed_at: isComplete ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,challenge_id" },
      );

      if (isComplete) {
        await supabase
          .from("users")
          .update({ total_points: (profile.total_points || 0) + c.points_reward })
          .eq("id", profile.id);
        await supabase.from("activity_log").insert({
          user_id: profile.id,
          action: "completed_challenge",
          points: c.points_reward,
          metadata: { challenge_id: c.id, title: c.title },
        });
        setRewardModal(c);
      } else {
        await supabase.from("activity_log").insert({
          user_id: profile.id,
          action: "challenge_progress",
          points: 0,
          metadata: { challenge_id: c.id, title: c.title, day: nextCount },
        });
      }

      await refreshProfile();
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Challenges</h1>
        <p className="text-sm text-muted-foreground">Start one. Crush it. Earn points.</p>
      </div>

      {rewardModal && (
        <RewardModal
          title={rewardModal.title}
          points={rewardModal.points_reward}
          onClose={() => setRewardModal(null)}
        />
      )}

      {challenges.length === 0 ? (
        <div className="surface-card grid place-items-center p-12 text-center">
          <Dumbbell className="mb-3 h-8 w-8 text-muted-foreground" />
          <h3 className="font-display font-semibold">No challenges yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Run the SUPABASE_SETUP.sql script in your Supabase SQL editor to seed challenges.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {challenges.map((c) => {
            const uc = mine[c.id];
            const done = uc?.status === "completed";
            const started = !!uc;
            const progress = done ? 1 : (uc?.progress ?? 0) / 100;
            const currentCount = uc?.progress_count || 0;
            const totalDays = c.total_days || 7;
            const Icon = pickIcon(c);
            return (
              <div
                key={c.id}
                className="surface-card group relative overflow-hidden transition-colors hover:border-primary/40"
                style={{
                  borderColor: done
                    ? "color-mix(in oklab, var(--color-secondary) 35%, transparent)"
                    : undefined,
                }}
              >
                <img
                  src={challengeImage(c.category, c.title)}
                  alt={`${c.category ?? "wellness"} challenge`}
                  className="h-36 w-full object-cover"
                />
                <div className="flex items-start gap-4 p-6">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <h3 className="font-display font-semibold">{c.title}</h3>
                      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-display font-semibold text-primary">
                        +{c.points_reward} pts
                      </span>
                    </div>
                    <p className="mb-4 text-sm text-muted-foreground">{c.description}</p>

                    <div className="mb-3">
                      <ProgressBar
                        value={progress}
                        color={done ? "var(--color-secondary)" : "var(--color-primary)"}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {done
                          ? "Completed"
                          : started
                            ? `In progress - Day ${currentCount} of ${totalDays}`
                            : `${totalDays} days challenge`}
                      </span>
                      {done ? (
                        <span
                          className="flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-xs font-display font-semibold"
                          style={{
                            backgroundColor:
                              "color-mix(in oklab, var(--color-secondary) 18%, transparent)",
                            color: "var(--color-secondary)",
                          }}
                        >
                          <Check className="h-3 w-3" /> Done
                        </span>
                      ) : started ? (
                        <button
                          onClick={() => markProgress(c)}
                          disabled={busy === c.id}
                          className="rounded-[8px] bg-primary px-3 py-1.5 text-xs font-display font-semibold text-primary-foreground disabled:opacity-60 transition-transform hover:scale-105 active:scale-95"
                        >
                          {busy === c.id ? "..." : `Mark Day ${currentCount + 1}`}
                        </button>
                      ) : (
                        <button
                          onClick={() => start(c)}
                          disabled={busy === c.id}
                          className="flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-xs font-display font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          <Play className="h-3 w-3" />
                          {busy === c.id ? "..." : "Start Challenge"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
