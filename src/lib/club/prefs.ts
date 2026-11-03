import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

export const THEME_COOKIE = "ucas-theme";

export type Theme = "dark" | "light";

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/**
 * The visitor's theme, readable during SSR as well as in the browser.
 *
 * An inline script in the document head already applies the `dark` class
 * before first paint, but React's own state started at light and corrected
 * itself after hydration, so the toggle's icon visibly swapped on every load.
 */
declare global {
  interface Window {
    /** The theme this document was server-rendered with, noted by the head script. */
    __ssrTheme?: Theme;
  }
}

export const readTheme = createIsomorphicFn()
  .server((): Theme => (getCookie(THEME_COOKIE) === "dark" ? "dark" : "light"))
  // The head script may rewrite the cookie from localStorage before hydration;
  // starting from the rendered theme avoids a mismatch that rebuilds the page.
  .client(
    (): Theme => window.__ssrTheme ?? (readCookie(THEME_COOKIE) === "dark" ? "dark" : "light"),
  );

/** Persist a preference where both the browser and the server can read it. */
export function writePrefCookie(name: string, value: string) {
  // A year, readable by the server, not sent on cross-site requests.
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}
