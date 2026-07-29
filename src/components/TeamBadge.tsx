export default function TeamBadge({
  name,
  slug,
  logoUrl,
  shortName,
  size = 24,
  className = "",
}: {
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  shortName?: string | null;
  size?: number;
  className?: string;
}) {
  // Prefer the admin-uploaded logo (Media admin), fall back to the git-uploaded static file by slug
  const src = logoUrl || (slug ? `/sponsors/${slug}.png` : null);
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <span
        className="rounded bg-white border border-[#0B3363]/15 flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ width: size, height: size }}
      >
        {src ? (
          <img src={src} alt={name} className="object-contain w-full h-full p-0.5" />
        ) : (
          <span className="font-display font-bold text-[#0B3363]" style={{ fontSize: size * 0.35 }}>
            {(shortName || name.slice(0, 2)).toUpperCase()}
          </span>
        )}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}
