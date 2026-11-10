import { useEffect, useState, type ReactNode } from "react";

/**
 * Plays one short pulse when `on` turns true, then leaves the element alone.
 *
 * A submission has landed and the reader should look down at it. The pulse
 * restarts only when a fresh success arrives, and the stylesheet drops it
 * entirely for visitors who have asked for reduced motion.
 */
export function SuccessPulse({ on, children }: { on: boolean; children: ReactNode }) {
  // The key changes only on a new success, so a re-render never replays it.
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (on) setRun((n) => n + 1);
  }, [on]);

  if (!run) return <>{children}</>;

  return (
    <div key={run} className="club-pulse-once">
      {children}
    </div>
  );
}
