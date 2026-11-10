import type { ReactNode } from "react";

/**
 * Two icons that trade places.
 *
 * The one leaving blurs away while the one arriving sharpens into place, and
 * both stay mounted the whole time, so nothing pops. The button that holds
 * them keeps its size either way.
 */
export function IconSwap({ on, off }: { on: ReactNode; off: ReactNode }) {
  return (
    <span className="club-icon-swap" aria-hidden="true">
      <span className="club-icon-swap-item" data-on={on ? "" : undefined}>
        {on}
      </span>
      <span className="club-icon-swap-item" data-on={off ? "" : undefined}>
        {off}
      </span>
    </span>
  );
}
