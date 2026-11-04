import { useState } from "react";
import { siteName } from "@/lib/club/seo";
import type { Lang } from "@/lib/club/model";

/** Real content photography, with the existing localized club artwork as fallback. */
export function ContentImage({
  src,
  alt,
  lang,
  className,
}: {
  src?: string | undefined;
  alt: string;
  lang: Lang;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const fallback = `/og/default-${lang}.jpg`;
  const source = src && !failed.includes(src) ? src : fallback;
  const placeholder = source === fallback;

  if (failed.includes(source))
    return (
      <div className={`flex items-center justify-center bg-muted text-primary ${className ?? ""}`}>
        <span className="text-xl font-bold">{siteName[lang]}</span>
      </div>
    );

  return (
    <img
      src={source}
      alt={
        placeholder
          ? lang === "ar"
            ? "تصميم تعريفي للنادي التكنولوجي"
            : "UCAS IT Club illustration"
          : alt
      }
      width={1200}
      height={630}
      loading="lazy"
      decoding="async"
      onError={() => setFailed((urls) => [...urls, source])}
      className={className}
    />
  );
}
