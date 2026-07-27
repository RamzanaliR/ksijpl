"use client";

import { useState } from "react";

export default function JerseyImage({
  teamSlug,
  variant,
  alt,
  className,
}: {
  teamSlug: string;
  variant: "home" | "away";
  alt: string;
  className?: string;
}) {
  const [format, setFormat] = useState<"png" | "svg" | "placeholder">("png");
  const src = format === "placeholder" ? "/jerseys/placeholder.png" : `/jerseys/${teamSlug}-${variant}.${format}`;

  function handleError() {
    if (format === "png") setFormat("svg");
    else if (format === "svg") setFormat("placeholder");
  }

  return <img src={src} alt={alt} className={className} onError={handleError} />;
}
