export const healthImages = {
  login:
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
  profile:
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80",
  dashboard:
    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1400&q=80",
  activity:
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80",
  cardio:
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80",
  nutrition:
    "https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&w=900&q=80",
  wellness:
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=80",
  recovery:
    "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80",
  strength:
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
};

export function challengeImage(category?: string | null, title?: string | null) {
  const key = (category || "").toLowerCase();
  if (key in healthImages) return healthImages[key as keyof typeof healthImages];

  // Fallback to inferring from title if category is missing or invalid
  const t = (title || "").toLowerCase();
  if (t.includes("step") || t.includes("run") || t.includes("walk") || t.includes("cardio")) return healthImages.cardio;
  if (t.includes("water") || t.includes("drink") || t.includes("hydrat")) return healthImages.activity;
  if (t.includes("protein") || t.includes("eat") || t.includes("diet") || t.includes("meal")) return healthImages.nutrition;
  if (t.includes("sleep") || t.includes("rest") || t.includes("mind") || t.includes("meditat")) return healthImages.recovery;
  if (t.includes("squat") || t.includes("lift") || t.includes("push") || t.includes("strength") || t.includes("workout")) return healthImages.strength;

  return healthImages.wellness;
}
