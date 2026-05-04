import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "challengex-auth" },
});

export type RankTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export const RANK_THRESHOLDS: { tier: RankTier; min: number; next: number | null }[] = [
  { tier: "Bronze", min: 0, next: 1000 },
  { tier: "Silver", min: 1000, next: 2500 },
  { tier: "Gold", min: 2500, next: 5000 },
  { tier: "Platinum", min: 5000, next: null },
];

export function getRank(points: number) {
  const r = [...RANK_THRESHOLDS].reverse().find((x) => points >= x.min)!;
  const progress = r.next ? (points - r.min) / (r.next - r.min) : 1;
  return { tier: r.tier, min: r.min, next: r.next, progress: Math.min(1, Math.max(0, progress)) };
}

export interface UserRow {
  id: string;
  email: string | null;
  name?: string | null;
  username: string | null;
  full_name: string | null;
  handle: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  calorie_goal: number | null;
  total_points: number;
  avatar_url: string | null;
  profile_completed: boolean | null;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  points_reward: number;
  icon: string | null;
  category: string | null;
  total_days?: number;
}

export interface UserChallenge {
  id?: string;
  user_id: string;
  challenge_id: string;
  status: string;
  progress: number;
  progress_count?: number;
  completed_at?: string | null;
}

export interface Room {
  id: string;
  name: string;
  status: string;
  challenge_id: string | null;
  created_by: string | null;
  max_players: number | null;
  created_at?: string;
}

export interface ActivityLog {
  id?: string;
  user_id: string;
  action: string;
  points: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
