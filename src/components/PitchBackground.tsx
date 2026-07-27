export default function PitchBackground({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden p-4 sm:p-6 ${className ?? ""}`}
      style={{ background: "linear-gradient(180deg, #2f8f4e 0%, #1f6b39 100%)" }}
    >
      {/* Mown-stripe texture */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 40px, transparent 40px, transparent 80px)",
        }}
      />
      {/* Goal + markings header bar */}
      <div className="relative flex items-center justify-center mb-4">
        <div className="flex-1 border-t-2 border-white/25" />
        <div className="mx-3 flex flex-col items-center flex-shrink-0">
          <div className="w-16 h-6 border-2 border-white/40 border-b-0 rounded-t-sm" />
          <div
            className="w-16 h-3 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 2px, transparent 2px, transparent 6px)",
            }}
          />
        </div>
        <div className="flex-1 border-t-2 border-white/25" />
      </div>
      {/* Penalty box arc */}
      <div className="absolute left-1/2 -translate-x-1/2 top-12 w-40 h-16 border-2 border-white/15 border-t-0 rounded-b-full pointer-events-none" />

      <div className="relative">{children}</div>

      {/* Center circle at the bottom */}
      <div className="relative flex items-center justify-center mt-4">
        <div className="flex-1 border-t-2 border-white/25" />
        <div className="mx-3 w-10 h-10 rounded-full border-2 border-white/25 flex-shrink-0" />
        <div className="flex-1 border-t-2 border-white/25" />
      </div>
    </div>
  );
}
