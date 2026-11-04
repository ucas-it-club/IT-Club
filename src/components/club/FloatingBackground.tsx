import { useEffect, useState } from "react";

// Replay only after a full document load, not internal navigation.
let pulseDocument: Document | undefined;

/**
 * Decorative background layer: subtle tech grid + soft floating brand blobs.
 */
export function FloatingBackground({ entrancePulse = false }: { entrancePulse?: boolean }) {
  const [showPulse, setShowPulse] = useState(false);
  useEffect(() => {
    if (!entrancePulse || pulseDocument === document) return;
    pulseDocument = document;
    setShowPulse(true);
  }, [entrancePulse]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {showPulse && (
        <>
          <div className="club-grid-pulse" />
          <div
            className="club-grid-pulse club-grid-pulse-second"
            onAnimationEnd={() => setShowPulse(false)}
          />
        </>
      )}
      <div className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,black,transparent)]" />
      {/* The same three brand glows, held still. Animating a blur(64px) layer
          of this size re-rasterises it every frame: measured on the built site
          it cost 52fps with a 33ms 95th-percentile frame, against 58fps at
          16.8ms once the animation came off. The drift it bought was 18px over
          nine seconds, which nobody can see. */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute top-1/2 -left-32 h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute -bottom-32 right-1/4 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
    </div>
  );
}
