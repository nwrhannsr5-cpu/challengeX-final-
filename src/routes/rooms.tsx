import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Crown,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";

import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  createChallengeRoom,
  fetchRoomBundle,
  fetchRooms,
  getLevel,
  getRoomMessagesChannel,
  markDailyProgress,
  normalizeRoomProfile,
  rankParticipants,
  requestJoinRoom,
  handleRoomRequest,
  sendRoomMessage,
  startChallenge,
  type Difficulty,
  type RoomBundle,
  type RoomMessage,
  type RoomRequest,
  type RoomSummary,
  type UserChallengeEntry,
} from "@/services/challengeRooms";

export const Route = createFileRoute("/rooms")({
  head: () => ({ meta: [{ title: "Challenge Rooms - ChallengeX" }] }),
  component: RoomsPage,
});

function RoomsPage() {
  const { profile, refreshProfile } = useAuth();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<RoomBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadRooms = async () => {
    setError(null);
    setLoading(true);
    try {
      const nextRooms = await fetchRooms();
      setRooms(nextRooms);
      if (!selectedRoomId && nextRooms[0]) setSelectedRoomId(nextRooms[0].id);
    } catch (err: any) {
      setError(err?.message || "Could not load rooms.");
    } finally {
      setLoading(false);
    }
  };

  const loadBundle = async (roomId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      setBundle(await fetchRoomBundle(roomId));
    } catch (err: any) {
      setError(err?.message || "Could not load room.");
      setBundle(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRoomId) return;
    void loadBundle(selectedRoomId);
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) return;

    const channel = getRoomMessagesChannel(selectedRoomId, (message) => {
      setBundle((current) =>
        current
          ? {
              ...current,
              messages: current.messages.some((item) => item.id === message.id)
                ? current.messages
                : [...current.messages, message],
            }
          : current,
      );
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedRoomId]);

  return (
    <div className="app-page max-w-7xl space-y-6 pr-20">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            Competitive Challenge Rooms
          </div>
          <h1 className="font-display text-4xl font-bold">Rooms</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Start fair challenges, track daily proof, compare progress, and chat live with the room.
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="primary-button px-4 py-2">
          <Plus className="h-4 w-4" />
          Create room
        </button>
      </header>

      {error && <div className="surface-panel px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => <RoomSkeleton key={index} />)
          ) : rooms.length === 0 ? (
            <div className="surface-card p-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No rooms yet. Create one to begin.</p>
            </div>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setSelectedRoomId(room.id)}
                className={`surface-card w-full p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 ${
                  selectedRoomId === room.id ? "border-primary/50 bg-primary/10" : ""
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold">{room.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {room.challenge?.title ?? "Challenge setup pending"}
                    </p>
                  </div>
                  <DifficultyBadge difficulty={room.difficulty} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{room.duration_days} days</span>
                  <span>{room.participant_count} competitors</span>
                </div>
              </button>
            ))
          )}
        </aside>

        <main className="min-w-0">
          {detailLoading ? (
            <div className="surface-card grid min-h-[34rem] place-items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : bundle ? (
            <RoomDetail
              bundle={bundle}
              currentUserId={profile?.id ?? null}
              currentPoints={profile?.total_points ?? 0}
              onReload={async () => {
                await loadBundle(bundle.room.id);
                await loadRooms();
                await refreshProfile();
              }}
              onError={setError}
            />
          ) : (
            <div className="surface-card grid min-h-[34rem] place-items-center p-10 text-center">
              <div>
                <Trophy className="mx-auto mb-3 h-10 w-10 text-primary" />
                <h2 className="font-display text-xl font-bold">Select a room</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a challenge room to see progress, leaderboard, and chat.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await loadRooms();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function RoomDetail({
  bundle,
  currentUserId,
  currentPoints,
  onReload,
  onError,
}: {
  bundle: RoomBundle;
  currentUserId: string | null;
  currentPoints: number;
  onReload: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState("");
  const ranked = useMemo(() => rankParticipants(bundle.participants), [bundle.participants]);
  const myEntry = bundle.participants.find((entry) => entry.user_id === currentUserId) ?? null;
  const myRank = ranked.findIndex((entry) => entry.user_id === currentUserId) + 1;

  const todayStr = new Date().toISOString().split("T")[0];
  const hasMarkedToday = bundle.dailyProgress.some(
    (dp) => dp.user_challenge_id === myEntry?.id && dp.date === todayStr
  );

  const isAdmin = bundle.room.created_by === currentUserId;
  const myRequest = bundle.requests.find((req) => req.user_id === currentUserId);

  const handleStart = async () => {
    if (!bundle.challenge) return;
    setBusy(true);
    onError(null);
    try {
      if (!myEntry) {
        if (isAdmin) {
          await startChallenge(bundle.challenge.id);
        } else {
          if (!currentUserId) throw new Error("Not logged in");
          await requestJoinRoom(bundle.room.id, currentUserId);
        }
      } else {
        await startChallenge(bundle.challenge.id);
      }
      await onReload();
    } catch (err: any) {
      onError(err?.message || "Could not start/request challenge.");
    } finally {
      setBusy(false);
    }
  };

  const handleProgress = async () => {
    if (!myEntry) return;
    setBusy(true);
    onError(null);
    try {
      await markDailyProgress(myEntry.id, proof.trim() || null);
      setProof("");
      await onReload();
    } catch (err: any) {
      onError(err?.message || "Could not save today's progress.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <section className="space-y-5">
        <div className="surface-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <DifficultyBadge difficulty={bundle.room.difficulty} />
              <h2 className="mt-3 font-display text-3xl font-bold">{bundle.room.name}</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {bundle.challenge?.description ?? "No challenge details yet."}
              </p>
            </div>
            <div className="rounded-[12px] bg-primary/15 px-4 py-3 text-right">
              <div className="font-display text-2xl font-bold text-primary">
                {bundle.room.duration_days}
              </div>
              <div className="text-xs text-muted-foreground">days</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Metric icon={Users} label="Competitors" value={bundle.participants.length.toString()} />
            <Metric icon={ShieldCheck} label="Anti-cheat" value="1/day" />
            <Metric icon={Sparkles} label="Your level" value={getLevel(currentPoints)} />
          </div>

          <div className="mt-5 rounded-[12px] border border-border bg-muted/35 p-4">
            {!myEntry ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold">Ready to compete?</h3>
                  <p className="text-sm text-muted-foreground">
                    {isAdmin
                      ? "As admin, you can start the challenge instantly."
                      : "Request to join the room and wait for admin approval."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={busy || !bundle.challenge || myRequest?.status === "pending"}
                  className="primary-button px-4 py-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isAdmin ? "Start" : myRequest?.status === "pending" ? "Pending..." : myRequest?.status === "rejected" ? "Rejected" : "Request to Join"}
                </button>
              </div>
            ) : myEntry.status === "not_started" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold">Request Approved!</h3>
                  <p className="text-sm text-muted-foreground">
                    You can now start tracking your daily progress.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={busy || !bundle.challenge}
                  className="primary-button px-4 py-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Start Tracking
                </button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <h3 className="font-display font-bold">Daily progress</h3>
                  <p className="text-sm text-muted-foreground">
                    One proof update is allowed per day. Completion is based on server-side rules.
                  </p>
                  <textarea
                    value={proof}
                    onChange={(event) => setProof(event.target.value)}
                    placeholder="Optional proof: note, image URL, or quick detail"
                    className="control-input mt-3 min-h-20 resize-none p-3"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleProgress()}
                  disabled={busy || myEntry.status === "completed" || hasMarkedToday}
                  className="primary-button self-end px-4 py-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {myEntry.status === "completed" ? "Completed" : hasMarkedToday ? "Done for today" : "Mark today"}
                </button>
              </div>
            )}
          </div>
        </div>

        <CompetitionView
          participants={ranked}
          totalDays={bundle.challenge?.total_days ?? bundle.room.duration_days}
          currentUserId={currentUserId}
        />
      </section>

      <aside className="space-y-5">
        {isAdmin && bundle.requests.some(r => r.status === "pending") && (
          <AdminRequestsPanel requests={bundle.requests} onReload={onReload} onError={onError} />
        )}
        <Leaderboard
          participants={ranked}
          totalDays={bundle.challenge?.total_days ?? bundle.room.duration_days}
          currentUserId={currentUserId}
          myRank={myRank}
        />
        <RoomChat roomId={bundle.room.id} messages={bundle.messages} currentUserId={currentUserId} onError={onError} onReload={onReload} />
      </aside>
    </div>
  );
}

function CompetitionView({
  participants,
  totalDays,
  currentUserId,
}: {
  participants: UserChallengeEntry[];
  totalDays: number;
  currentUserId: string | null;
}) {
  return (
    <section className="surface-card p-5">
      <h3 className="font-display text-xl font-bold">Competition view</h3>
      <p className="mb-4 text-sm text-muted-foreground">Compare progress visually across the room.</p>

      <div className="space-y-3">
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No competitors yet.</p>
        ) : (
          participants.map((entry, index) => {
            const person = normalizeRoomProfile(entry.profiles);
            const percent = Math.min(100, Math.round((entry.progress_count / totalDays) * 100));
            const leading = index === 0;
            return (
              <div
                key={entry.id}
                className={`rounded-[12px] border p-4 transition-colors ${
                  entry.user_id === currentUserId
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-muted/25"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={person?.username ?? "User"} avatarUrl={person?.avatar_url ?? null} />
                    <div className="min-w-0">
                      <div className="truncate font-display font-bold">
                        {person?.username ?? "User"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.progress_count}/{totalDays} days - {entry.status}
                      </div>
                    </div>
                  </div>
                  {leading && <Crown className="h-5 w-5 text-primary" />}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-xs text-muted-foreground">{percent}%</div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function Leaderboard({
  participants,
  totalDays,
  currentUserId,
  myRank,
}: {
  participants: UserChallengeEntry[];
  totalDays: number;
  currentUserId: string | null;
  myRank: number;
}) {
  return (
    <section className="surface-card p-5">
      <h3 className="font-display text-xl font-bold">Leaderboard</h3>
      <p className="mb-4 text-sm text-muted-foreground">Ranked by fastest completion, then earlier start.</p>

      <div className="space-y-3">
        {participants.slice(0, 3).map((entry, index) => {
          const person = normalizeRoomProfile(entry.profiles);
          return (
            <div key={entry.id} className="flex items-center gap-3 rounded-[12px] bg-muted/35 p-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 font-display font-bold text-primary">
                {["1", "2", "3"][index]}
              </div>
              <Avatar name={person?.username ?? "User"} avatarUrl={person?.avatar_url ?? null} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-bold">
                  {person?.username ?? "User"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {entry.progress_count}/{totalDays} days
                </div>
              </div>
              <Trophy className="h-4 w-4 text-primary" />
            </div>
          );
        })}
      </div>

      {currentUserId && myRank > 0 && (
        <div className="mt-4 rounded-[12px] border border-primary/30 bg-primary/10 p-3 text-sm">
          Your current rank: <span className="font-display font-bold text-primary">#{myRank}</span>
        </div>
      )}
    </section>
  );
}

function RoomChat({
  roomId,
  messages,
  currentUserId,
  onError,
  onReload,
}: {
  roomId: string;
  messages: RoomMessage[];
  currentUserId: string | null;
  onError: (message: string | null) => void;
  onReload: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!currentUserId || !message.trim()) return;
    setSending(true);
    onError(null);
    try {
      await sendRoomMessage({ roomId, userId: currentUserId, content: message });
      setMessage("");
      await onReload();
    } catch (err: any) {
      onError(err?.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="surface-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h3 className="font-display text-xl font-bold">Room chat</h3>
      </div>
      <div className="mb-3 max-h-80 space-y-3 overflow-auto rounded-[12px] bg-muted/30 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((item) => {
            const person = normalizeRoomProfile(item.profiles);
            const mine = item.user_id === currentUserId;
            return (
              <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-[12px] px-3 py-2 ${
                    mine ? "bg-primary text-primary-foreground" : "bg-card"
                  }`}
                >
                  <div className="text-[11px] font-bold opacity-80">{person?.username ?? "User"}</div>
                  <p className="text-sm">{item.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Send a message"
          className="control-input h-10 px-3"
        />
        <button type="submit" disabled={sending} className="primary-button h-10 w-10 disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </section>
  );
}

function CreateRoomModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [durationDays, setDurationDays] = useState(7);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const canCreate = name.trim() && title.trim() && description.trim() && durationDays > 0;

  const submit = async () => {
    if (!canCreate) return;
    setBusy(true);
    onError(null);
    try {
      await createChallengeRoom({ name, difficulty, durationDays, title, description });
      await onCreated();
    } catch (err: any) {
      onError(err?.message || "Could not create room.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-4">
      <div className="surface-card w-full max-w-xl p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Create challenge room</h2>
            <p className="text-sm text-muted-foreground">A room includes one fair daily challenge.</p>
          </div>
          <button type="button" onClick={onClose} className="secondary-button h-9 w-9">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Room name" className="control-input h-11 px-3" />
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Challenge title" className="control-input h-11 px-3" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Challenge description" className="control-input min-h-24 resize-none p-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} className="control-input h-11 px-3">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <input type="number" min={1} max={90} value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value) || 1)} className="control-input h-11 px-3" />
          </div>
          <button type="button" onClick={() => void submit()} disabled={!canCreate || busy} className="primary-button mt-2 px-4 py-2 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-muted/35 p-3">
      <Icon className="mb-2 h-4 w-4 text-primary" />
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
      {difficulty}
    </span>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }

  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary font-display font-bold text-primary-foreground">
      {name.trim()[0]?.toUpperCase() || "?"}
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div className="surface-card animate-pulse p-4">
      <div className="h-5 w-32 rounded bg-primary/15" />
      <div className="mt-2 h-3 w-48 rounded bg-primary/10" />
      <div className="mt-5 h-3 w-full rounded bg-primary/10" />
    </div>
  );
}

function AdminRequestsPanel({ requests, onReload, onError }: { requests: RoomRequest[]; onReload: () => Promise<void>; onError: (msg: string) => void }) {
  const pending = requests.filter(r => r.status === "pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      await handleRoomRequest(id, action);
      await onReload();
    } catch (err: any) {
      onError(err?.message || "Could not handle request.");
    } finally {
      setBusyId(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <section className="surface-card p-5 border-primary/40 shadow-primary/5">
      <h3 className="font-display text-xl font-bold flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        Join Requests
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">Approve competitors to let them start.</p>
      <div className="space-y-3">
        {pending.map(req => {
          const person = normalizeRoomProfile(req.profiles);
          return (
            <div key={req.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-muted/20 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={person?.username ?? "User"} avatarUrl={person?.avatar_url ?? null} />
                <div className="truncate font-display text-sm font-bold">{person?.username ?? "User"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAction(req.id, "approve")}
                  disabled={!!busyId}
                  className="rounded-full bg-primary/10 p-2 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleAction(req.id, "reject")}
                  disabled={!!busyId}
                  className="rounded-full bg-destructive/10 p-2 text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

