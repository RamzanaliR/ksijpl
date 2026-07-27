"use client";

import { useState } from "react";

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
  isGoalkeeper,
  opponentCode,
  opponentIsHome,
  onRemove,
  onClick,
  onSubClick,
  showSubIcon,
  dimmed,
  selected,
  highlighted,
  isCaptain,
  isViceCaptain,
  onSetCaptain,
  onSetVice,
  points,
}: {
  name: string;
  price?: number;
  teamSlug?: string | null;
  isGoalkeeper?: boolean;
  opponentCode?: string | null;
  opponentIsHome?: boolean | null;
  onRemove?: () => void;
  onClick?: () => void;
  onSubClick?: () => void;
  showSubIcon?: boolean;
  dimmed?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  onSetCaptain?: () => void;
  onSetVice?: () => void;
  points?: number;
}) {
  const Wrapper = onClick ? "button" : "div";
  const jerseySrc = teamSlug ? `/jerseys/${teamSlug}${isGoalkeeper ? "-gk-home" : "-home"}.svg` : null;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`relative w-24 sm:w-28 flex-shrink-0 transition-all rounded-xl bg-white/10 p-1.5 pt-2 ${dimmed ? "opacity-40" : ""} ${
        selected ? "ring-2 ring-[#F4B400]" : ""
      } ${highlighted ? "ring-2 ring-[#3EA0D9] scale-105" : ""}`}
    >
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove player"
          className="absolute -top-1.5 -left-1.5 z-10 w-5 h-5 rounded-full bg-[#0B1220] text-white text-xs font-bold flex items-center justify-center shadow-sm hover:bg-red-600"
        >
          ×
        </button>
      )}
      {showSubIcon && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSubClick?.();
          }}
          aria-label="Substitute"
          className={`absolute -top-1.5 -left-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${
            selected ? "bg-red-500 text-white" : "bg-[#F4B400] text-[#0B3363]"
          }`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {selected ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />}
          </svg>
        </button>
      )}
      {(onSetCaptain || onSetVice) && (
        <div className="absolute -top-1.5 -right-1.5 z-10 flex flex-col gap-1">
          {onSetCaptain && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetCaptain();
              }}
              aria-label="Set captain"
              className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm transition-colors ${
                isCaptain ? "bg-[#F4B400] text-[#0B3363]" : "bg-white/70 text-[#0B3363]/50 hover:bg-white"
              }`}
            >
              C
            </button>
          )}
          {onSetVice && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetVice();
              }}
              aria-label="Set vice-captain"
              className={`w-5 h-5 rounded-full text-[8px] font-bold flex items-center justify-center shadow-sm transition-colors ${
                isViceCaptain ? "bg-[#3EA0D9] text-white" : "bg-white/70 text-[#0B3363]/50 hover:bg-white"
              }`}
            >
              VC
            </button>
          )}
        </div>
      )}

      <Wrapper onClick={onClick} className="w-full flex flex-col items-center">
        {price !== undefined && (
          <div className="font-display font-bold text-white text-xs sm:text-sm mb-1 drop-shadow-sm">
            TSH {price.toFixed(1)}m
          </div>
        )}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mb-1.5">
          {jerseySrc && !imgError ? (
            <img src={jerseySrc} alt={name} className="w-full h-full object-contain" onError={() => setImgError(true)} />
          ) : (
            <GenericShirt className="w-full h-full" />
          )}
        </div>
        <div className="w-full">
          <div className="bg-white rounded-t-md px-1.5 py-1 w-full">
            <div className="text-[10px] sm:text-[11px] font-bold text-[#0B3363] truncate">{name}</div>
          </div>
          {opponentCode && (
            <div className="bg-[#0B3363]/10 rounded-b-md px-1.5 py-0.5 w-full">
              <div className="text-[9px] text-[#0B3363]/60 font-medium">
                {opponentCode} ({opponentIsHome ? "H" : "A"})
              </div>
            </div>
          )}
        </div>
        {points !== undefined && <div className="text-white font-display font-bold text-[11px] mt-1">{points} pts</div>}
      </Wrapper>
    </div>
  );
}
