import Image from "next/image";

export default function TeamBadge({
  name,
  slug,
  shortName,
  size = 24,
  className = "",
}: {
  name: string;
  slug?: string | null;
  shortName?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <span
        className="rounded bg-white border border-[#0B3363]/15 flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ width: size, height: size }}
      >
        {slug ? (
          <Image src={`/sponsors/${slug}.png`} alt={name} width={size - 4} height={size - 4} className="object-contain w-full h-full" />
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
