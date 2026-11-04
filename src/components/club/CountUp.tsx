import { useEffect, useRef, useState } from "react";

/**
 * A statistic that counts up the first time it is seen.
 *
 * The homepage's three figures were the only numbers on the page and they just
 * sat there. Counting them in gives the hero something that happens without
 * adding a library or another network request.
 *
 * Renders the final value immediately when motion is reduced or when the value
 * is not yet known, so the number is never wrong or missing.
 */
export function CountUp({ value, duration = 1100 }: { value: number | null; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;

    if (node === null || value === null) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || value <= 0) return;

    // Drop to zero only now, on the client. The server and any visitor without
    // JavaScript keep the real figure — rendering 0 there put "0 members" in
    // the document and in front of crawlers.
    setShown(0);
    let frame = 0;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // Ease out so the last digits settle instead of snapping.
        setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));

        if (t < 1) frame = requestAnimationFrame(step);
      };

      frame = requestAnimationFrame(step);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {value === null ? "—" : (shown ?? value)}
    </span>
  );
}
