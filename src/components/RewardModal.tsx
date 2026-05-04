import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";

export function RewardModal({
  title,
  points,
  onClose,
}: {
  title: string;
  points: number;
  onClose: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Slight delay for animation entry
    const t = setTimeout(() => setShow(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 px-4 backdrop-blur-sm transition-opacity duration-300">
      {/* CSS Confetti Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 h-3 w-2 animate-confetti rounded-sm"
            style={{
              left: `${Math.random() * 100}%`,
              backgroundColor: ["#D8A47F", "#A66B4A", "#1C3B32", "#688A60", "#F5EBE1"][
                Math.floor(Math.random() * 5)
              ],
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div
        className={`relative w-full max-w-sm transform overflow-hidden rounded-[20px] bg-card p-6 text-center shadow-2xl transition-all duration-500 ${
          show ? "translate-y-0 scale-100 opacity-100" : "translate-y-10 scale-95 opacity-0"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-primary/20">
          <Trophy className="h-10 w-10 text-primary drop-shadow-md" />
        </div>

        <h2 className="mb-2 font-display text-2xl font-bold text-foreground">Challenge Complete!</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          You crushed <strong className="text-foreground">"{title}"</strong> and earned a massive reward.
        </p>

        <div className="mx-auto mb-6 inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 font-display text-xl font-bold text-primary">
          +{points} pts
        </div>

        <button onClick={onClose} className="primary-button w-full py-3 text-sm">
          Keep Going
        </button>
      </div>

      <style>{`
        @keyframes confetti {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti linear infinite;
        }
      `}</style>
    </div>
  );
}
