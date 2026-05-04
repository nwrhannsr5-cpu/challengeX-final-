import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Store, Tag, ArrowRight, Loader2, Award, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RewardModal } from "@/components/RewardModal";

export const Route = createFileRoute("/partners")({
  head: () => ({ meta: [{ title: "Partners Marketplace - ChallengeX" }] }),
  component: PartnersPage,
});

const PARTNERS = [
  {
    id: "p1",
    name: "GreenBowl",
    category: "Healthy Meals",
    description: "Fresh, organic salads and protein bowls delivered to your door.",
    pointsReward: 150,
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80",
  },
  {
    id: "p2",
    name: "NutriLife Supplements",
    category: "Vitamins & Protein",
    description: "Premium whey protein and daily multivitamins for your fitness journey.",
    pointsReward: 300,
    image: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=800&q=80",
  },
  {
    id: "p3",
    name: "FitGear Apparel",
    category: "Sportswear",
    description: "High-performance activewear designed for extreme workouts.",
    pointsReward: 200,
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
  },
];

const REWARDS = [
  {
    id: "r1",
    title: "50 EGP GreenBowl Voucher",
    description: "Get 50 EGP off your next healthy salad bowl.",
    pointsCost: 1000,
    color: "var(--color-primary)",
  },
  {
    id: "r2",
    title: "1-Day Free Gym Pass",
    description: "Access any Gold's Gym branch for one full day.",
    pointsCost: 2500,
    color: "var(--color-secondary)",
  },
  {
    id: "r3",
    title: "Free NutriLife Shaker",
    description: "Claim a free premium protein shaker bottle.",
    pointsCost: 1500,
    color: "var(--color-streak)",
  },
];

function PartnersPage() {
  const { profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState<{ title: string; pts: number } | null>(null);

  const handleOrder = async (partner: typeof PARTNERS[0]) => {
    if (!profile) return;
    setBusy(partner.id);
    try {
      const newPoints = (profile.total_points || 0) + partner.pointsReward;
      
      // Update points
      await supabase.from("users").update({ total_points: newPoints }).eq("id", profile.id);
      
      // Log activity
      await supabase.from("activity_log").insert({
        user_id: profile.id,
        action: "partner_purchase",
        points: partner.pointsReward,
        metadata: { partner_id: partner.id, partner_name: partner.name },
      });

      await refreshProfile();
      toast.success(`Ordered from ${partner.name}! +${partner.pointsReward} pts added.`);
      setShowCelebration({ title: `Ordered from ${partner.name}`, pts: partner.pointsReward });
    } catch (err: any) {
      toast.error(err?.message || "Failed to process order.");
    } finally {
      setBusy(null);
    }
  };

  const handleRedeem = async (reward: typeof REWARDS[0]) => {
    if (!profile) return;
    if ((profile.total_points || 0) < reward.pointsCost) {
      toast.error("Not enough points to redeem this reward.");
      return;
    }
    setBusy(reward.id);
    try {
      const newPoints = (profile.total_points || 0) - reward.pointsCost;
      
      // Update points
      await supabase.from("users").update({ total_points: newPoints }).eq("id", profile.id);
      
      // Log activity
      await supabase.from("activity_log").insert({
        user_id: profile.id,
        action: "reward_redemption",
        points: -reward.pointsCost,
        metadata: { reward_id: reward.id, reward_title: reward.title },
      });

      await refreshProfile();
      toast.success(`Successfully redeemed: ${reward.title}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to redeem reward.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-8">
      {showCelebration && (
        <RewardModal
          title={showCelebration.title}
          points={showCelebration.pts}
          onClose={() => setShowCelebration(null)}
        />
      )}

      {/* Header */}
      <div>
        <div className="mb-2 inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
          ChallengeX Business
        </div>
        <h1 className="font-display text-4xl font-bold">Partners & Rewards</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Shop healthy products from our exclusive partners to earn massive points. Then, redeem those points for real-world vouchers and gifts!
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
        
        {/* Partners Section */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-bold">Partner Brands</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {PARTNERS.map((partner) => (
              <div key={partner.id} className="surface-card group overflow-hidden transition-all hover:border-primary/40 hover:-translate-y-1">
                <div className="relative h-40 overflow-hidden">
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                  <img src={partner.image} alt={partner.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute bottom-3 left-3 z-20 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-bold text-white">
                    {partner.category}
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-display text-xl font-bold leading-tight">{partner.name}</h3>
                    <div className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                      +{partner.pointsReward} pts
                    </div>
                  </div>
                  <p className="mb-5 text-sm text-muted-foreground line-clamp-2">{partner.description}</p>
                  <button
                    onClick={() => handleOrder(partner)}
                    disabled={busy === partner.id}
                    className="primary-button w-full justify-between py-3 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      {busy === partner.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      Order via ChallengeX
                    </span>
                    <ArrowRight className="h-4 w-4 opacity-50" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rewards Section */}
        <aside className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-secondary" />
              <h2 className="font-display text-2xl font-bold">Redeem</h2>
            </div>
            <div className="text-right">
              <div className="font-display text-xl font-bold text-primary tabular-nums">
                {profile?.total_points?.toLocaleString() ?? 0}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your Points</div>
            </div>
          </div>
          
          <div className="space-y-4">
            {REWARDS.map((reward) => {
              const canAfford = (profile?.total_points ?? 0) >= reward.pointsCost;
              return (
                <div key={reward.id} className="surface-card p-5 transition-colors hover:border-border/80">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10">
                      <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold tabular-nums" style={{ color: reward.color }}>
                        {reward.pointsCost.toLocaleString()}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost</div>
                    </div>
                  </div>
                  <h3 className="mb-1 font-display font-bold">{reward.title}</h3>
                  <p className="mb-4 text-xs text-muted-foreground">{reward.description}</p>
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={busy === reward.id || !canAfford}
                    className="w-full rounded-[10px] border border-transparent bg-muted/50 px-4 py-2.5 text-sm font-bold text-foreground transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === reward.id ? (
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    ) : canAfford ? (
                      "Redeem Voucher"
                    ) : (
                      "Not enough points"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

      </div>
    </div>
  );
}
