import { getRank, type RankTier } from "@/lib/supabase";

const tierColor: Record<RankTier, string> = {
  Bronze: "var(--color-rank-bronze)",
  Silver: "var(--color-rank-silver)",
  Gold: "var(--color-rank-gold)",
  Platinum: "var(--color-rank-platinum)",
};

export function RankBadge({ tier, size = "md" }: { tier: RankTier; size?: "sm" | "md" }) {
  const color = tierColor[tier];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-display font-semibold ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        border: `0.5px solid color-mix(in oklab, ${color} 35%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {tier}
    </span>
  );
}

export function ProgressBar({
  value,
  color = "var(--color-primary)",
  height = 6,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-muted" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value * 100))}%`,
          backgroundColor: color,
          boxShadow: `0 0 12px color-mix(in oklab, ${color} 60%, transparent)`,
        }}
      />
    </div>
  );
}

export { getRank };
