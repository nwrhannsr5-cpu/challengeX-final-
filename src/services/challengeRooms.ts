import { supabase } from "@/lib/supabase";

export type Difficulty = "easy" | "medium" | "hard";
export type ChallengeStatus = "not_started" | "active" | "completed";

export interface RoomSummary {
  id: string;
  name: string;
  difficulty: Difficulty;
  duration_days: number;
  created_at: string;
  created_by?: string;
  challenge?: RoomChallenge | null;
  participant_count: number;
}

export type RequestStatus = "pending" | "approved" | "rejected";

export interface RoomRequest {
  id: string;
  room_id: string;
  user_id: string;
  status: RequestStatus;
  created_at: string;
  profiles: RoomProfile | RoomProfile[] | null;
}

export interface RoomChallenge {
  id: string;
  room_id: string;
  title: string;
  description: string;
  total_days: number;
  created_at: string;
}

export interface RoomProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

export interface UserChallengeEntry {
  id: string;
  user_id: string;
  challenge_id: string;
  start_time: string | null;
  end_time: string | null;
  status: ChallengeStatus;
  progress_count: number;
  profiles: RoomProfile | RoomProfile[] | null;
}

export interface DailyProgress {
  id: string;
  user_challenge_id: string;
  date: string;
  completed: boolean;
  proof: string | null;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: RoomProfile | RoomProfile[] | null;
}

export interface RoomBundle {
  room: RoomSummary;
  challenge: RoomChallenge | null;
  participants: UserChallengeEntry[];
  dailyProgress: DailyProgress[];
  messages: RoomMessage[];
  requests: RoomRequest[];
}

const CHALLENGE_SELECT = "id, room_id, title, description, total_days, created_at";
const PARTICIPANT_SELECT =
  "id, user_id, challenge_id, start_time, end_time, status, progress_count, profiles(id, username, avatar_url)";
const MESSAGE_SELECT = "id, room_id, user_id, content, created_at, profiles(id, username, avatar_url)";

export async function fetchRooms(): Promise<RoomSummary[]> {
  const [{ data: rooms, error: roomError }, { data: challenges, error: challengeError }] =
    await Promise.all([
      supabase
        .from("challenge_rooms")
        .select("id, name, difficulty, duration_days, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("challenges").select(CHALLENGE_SELECT),
    ]);

  if (roomError) throw roomError;
  if (challengeError) throw challengeError;

  const roomList = (rooms ?? []) as RoomSummary[];
  const challengeList = (challenges ?? []) as RoomChallenge[];
  const challengeByRoom = new Map(challengeList.map((challenge) => [challenge.room_id, challenge]));

  const challengeIds = challengeList.map((challenge) => challenge.id);
  const { data: participants, error: participantError } =
    challengeIds.length > 0
      ? await supabase.from("user_challenges").select("challenge_id").in("challenge_id", challengeIds)
      : { data: [], error: null };

  if (participantError) throw participantError;

  const counts = new Map<string, number>();
  (participants ?? []).forEach((participant) => {
    counts.set(participant.challenge_id, (counts.get(participant.challenge_id) ?? 0) + 1);
  });

  return roomList.map((room) => {
    const challenge = challengeByRoom.get(room.id) ?? null;
    return {
      ...room,
      challenge,
      participant_count: challenge ? (counts.get(challenge.id) ?? 0) : 0,
    };
  });
}

export async function createChallengeRoom({
  name,
  difficulty,
  durationDays,
  title,
  description,
}: {
  name: string;
  difficulty: Difficulty;
  durationDays: number;
  title: string;
  description: string;
}) {
  const { error } = await supabase.rpc("create_room_with_challenge", {
    p_name: name.trim(),
    p_difficulty: difficulty,
    p_duration_days: durationDays,
    p_title: title.trim(),
    p_description: description.trim(),
  });

  if (error) throw error;
}

export async function fetchRoomBundle(roomId: string): Promise<RoomBundle> {
  const { data: room, error: roomError } = await supabase
    .from("challenge_rooms")
    .select("id, name, difficulty, duration_days, created_at, created_by")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError) throw roomError;
  if (!room) throw new Error("Room not found.");

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select(CHALLENGE_SELECT)
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (challengeError) throw challengeError;

  const challengeRow = (challenge as RoomChallenge | null) ?? null;
  const [{ data: participants, error: participantsError }, { data: messages, error: messagesError }, { data: requests, error: requestsError }] =
    await Promise.all([
      challengeRow
        ? supabase
            .from("user_challenges")
            .select(PARTICIPANT_SELECT)
            .eq("challenge_id", challengeRow.id)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(80),
      supabase
        .from("room_requests")
        .select("id, room_id, user_id, status, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false }),
    ]);

  if (participantsError) throw participantsError;
  if (messagesError) throw messagesError;
  if (requestsError) throw requestsError;

  const requestRows = (requests ?? []) as unknown as RoomRequest[];
  const requestUserIds = requestRows.map((req) => req.user_id);
  
  if (requestUserIds.length > 0) {
    const { data: requestProfiles, error: requestProfilesError } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", requestUserIds);
      
    if (!requestProfilesError && requestProfiles) {
      const profileMap = new Map(requestProfiles.map(p => [p.id, p]));
      for (const req of requestRows) {
        req.profiles = profileMap.get(req.user_id) ?? null;
      }
    }
  }

  const participantRows = (participants ?? []) as unknown as UserChallengeEntry[];
  const progressIds = participantRows.map((entry) => entry.id);
  const { data: progress, error: progressError } =
    progressIds.length > 0
      ? await supabase
          .from("daily_progress")
          .select("id, user_challenge_id, date, completed, proof")
          .in("user_challenge_id", progressIds)
          .order("date", { ascending: true })
      : { data: [], error: null };

  if (progressError) throw progressError;

  return {
    room: {
      ...(room as RoomSummary),
      challenge: challengeRow,
      participant_count: participantRows.length,
    },
    challenge: challengeRow,
    participants: participantRows,
    dailyProgress: (progress ?? []) as DailyProgress[],
    messages: (messages ?? []) as unknown as RoomMessage[],
    requests: requestRows,
  };
}

export async function startChallenge(challengeId: string) {
  const { error } = await supabase.rpc("start_challenge", { p_challenge_id: challengeId });
  if (error) throw error;
}

export async function markDailyProgress(userChallengeId: string, proof: string | null) {
  const { error } = await supabase.rpc("mark_daily_progress", {
    p_user_challenge_id: userChallengeId,
    p_proof: proof,
  });
  if (error) throw error;
}

export async function sendRoomMessage({
  roomId,
  userId,
  content,
}: {
  roomId: string;
  userId: string;
  content: string;
}) {
  const { error } = await supabase.from("messages").insert({
    room_id: roomId,
    user_id: userId,
    content: content.trim(),
  });

  if (error) throw error;
}

export function getRoomMessagesChannel(roomId: string, onMessage: (message: RoomMessage) => void) {
  return supabase
    .channel(`room-chat:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        const { data } = await supabase
          .from("messages")
          .select(MESSAGE_SELECT)
          .eq("id", payload.new.id)
          .maybeSingle();
        if (data) onMessage(data as unknown as RoomMessage);
      },
    )
    .subscribe();
}

export function normalizeRoomProfile(profile: RoomProfile | RoomProfile[] | null) {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile;
}

export function getCompletionDuration(entry: UserChallengeEntry) {
  if (!entry.start_time || !entry.end_time) return Number.POSITIVE_INFINITY;
  return new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
}

export function rankParticipants(participants: UserChallengeEntry[]) {
  return [...participants].sort((a, b) => {
    const aCompleted = a.status === "completed";
    const bCompleted = b.status === "completed";

    if (aCompleted && bCompleted) {
      const durationDelta = getCompletionDuration(a) - getCompletionDuration(b);
      if (durationDelta !== 0) return durationDelta;
      return new Date(a.start_time ?? 0).getTime() - new Date(b.start_time ?? 0).getTime();
    }

    if (aCompleted !== bCompleted) return aCompleted ? -1 : 1;
    if (a.progress_count !== b.progress_count) return b.progress_count - a.progress_count;
    return new Date(a.start_time ?? 0).getTime() - new Date(b.start_time ?? 0).getTime();
  });
}

export function getLevel(points: number) {
  if (points >= 2500) return "Pro";
  if (points >= 900) return "Intermediate";
  return "Beginner";
}

export async function requestJoinRoom(roomId: string, userId: string) {
  const { error } = await supabase.from("room_requests").insert({
    room_id: roomId,
    user_id: userId,
  });
  if (error) throw error;
}

export async function handleRoomRequest(requestId: string, action: "approve" | "reject") {
  const { error } = await supabase.rpc("handle_room_request", {
    p_request_id: requestId,
    p_status: action === "approve" ? "approved" : "rejected",
  });
  if (error) throw error;
}
