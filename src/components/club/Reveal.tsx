import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Reveal content once it scrolls into view.
 *
 * The site's sections all arrived fully formed, which is what made the inner
 * pages read as static. One shared observer instead of a library: the element
 * starts shifted and transparent, settles when it first becomes visible, and
 * never animates again.
 *
 * Content is visible by default when JavaScript never runs, and the transition
 * is dropped entirely for visitors who ask for reduced motion.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  /** Stagger step in milliseconds; keep under ~400ms total across a group. */
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;

    if (!node) return;

    // Anything already on screen at mount should not fade in under the reader.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`club-reveal ${shown ? "is-shown" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
