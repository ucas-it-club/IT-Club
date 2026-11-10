import type { CSSProperties } from "react";

/**
 * The page's background: a faint grid, soft brand glows, and a few small lights that
 * travel along the grid lines so the screen is never entirely still. Fixed behind
 * everything and drawn from transforms only. Particles are off for reduced motion.
 *
 * Each particle: [axis, grid line index, seconds per pass, start offset, reversed, colour].
 */
const particles: [
  axis: "x" | "y",
  line: number,
  secs: number,
  offset: number,
  rev: boolean,
  color: string,
][] = [
  ["x", 3, 26, -4, false, "var(--primary)"],
  ["x", 8, 34, -19, true, "var(--accent)"],
  ["x", 13, 30, -11, false, "var(--primary)"],
  ["y", 4, 28, -8, false, "var(--accent)"],
  ["y", 11, 36, -22, true, "var(--primary)"],
  ["y", 19, 32, -14, false, "var(--primary)"],
];

export function SiteBackground() {
  return (
    <div aria-hidden="true" className="club-bg">
      <div className="club-bg-lines" />
      <i className="club-bg-glow club-bg-glow-a" />
      <i className="club-bg-glow club-bg-glow-b" />
      <i className="club-bg-glow club-bg-glow-c" />
      {particles.map(([axis, line, secs, offset, rev, color], i) => (
        <i
          key={i}
          className="club-bg-dot"
          data-axis={axis}
          data-rev={rev ? "" : undefined}
          style={
            {
              "--line": line,
              "--dur": `${secs}s`,
              "--delay": `${offset}s`,
              "--c": color,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
