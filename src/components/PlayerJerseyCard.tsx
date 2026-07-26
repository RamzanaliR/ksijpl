"use client";

function GenericShirt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M30 15 L10 28 L18 42 L28 36 L28 88 L72 88 L72 36 L82 42 L90 28 L70 15 C70 15 62 24 50 24 C38 24 30 15 30 15 Z"
        fill="#0B3363"
        stroke="#3EA0D9"
        strokeWidth="2"
      />
    </svg>
  );
}

export default function PlayerJerseyCard({
  name,
  price,
  teamSlug,
  opponentCode,
  opponentIsHome,
  badge,
  onRemove,
  onClick,
  showSubIcon,
  dimmed,
}: {
  name: string;
  price?: number;
  teamSlug?: string | null;
  opponentCode?: string | null;
  opponentIsHome?: boolean | null;
  badge?: "C" | "V" | null;
  onRemove?: () => void;
  onClick?: () => void;
  showSubIcon?: boolean;
  dimmed?: boolean;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <div className={`relative w-20 sm:w-24 flex-shrink-0 text-center ${dimmed ? "opacity-60" : ""}`}>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove player"
          className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-white border border-[#0B3363]/20 text-[#0B3363] text-xs font-bold flex items-center justify-center shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200"
        >
          ×
        </button>
      )}
      {showSubIcon && (
        <span className="absolute -top-1.5 -left-1.5 z-10 w-5 h-5 rounded-full bg-[#F4B400] text-[#0B3363] flex items-center justify-center shadow-sm">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
          </svg>
        </span>
      )}
      {badge && (
        <span
          className={`absolute -top-1.5 -left-1.5 z-10 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm ${
            badge === "C" ? "bg-[#F4B400] text-[#0B3363]" : "bg-[#3EA0D9] text-white"
          }`}
        >
          {badge}
        </span>
      )}

      <Wrapper onClick={onClick} className="w-full flex flex-col items-center">
        {price !== undefined && (
          <div className="text-[10px] font-bold bg-[#0B3363] text-white rounded-full px-2 py-0.5 mb-1 inline-block">
            TSH {price.toFixed(1)}m
          </div>
        )}
        <div className="w-12 h-12 sm:w-14 sm:h-14 mb-1">
          {teamSlug ? (
            <img src={`/jerseys/${teamSlug}-home.jpg`} alt={name} className="w-full h-full object-contain rounded" />
          ) : (
            <GenericShirt className="w-full h-full" />
          )}
        </div>
        <div className="bg-white rounded-lg px-1.5 py-1 w-full shadow-sm">
          <div className="text-[10px] sm:text-[11px] font-semibold text-[#0B3363] truncate">{name}</div>
          {opponentCode && (
            <div className="text-[9px] text-[#0B3363]/50">
              {opponentCode} ({opponentIsHome ? "H" : "A"})
            </div>
          )}
        </div>
      </Wrapper>
    </div>
  );
}
