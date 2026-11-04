import { recordClubVisit } from "./public-api";
import { pageOf } from "./paths";

let request: Promise<number> | undefined;

let sessionId: string | undefined;

export function recordVisit(): Promise<number> {
  if (request) return request;

  try {
    sessionId = sessionStorage.getItem("club-visit-session") || undefined;
  } catch {
    /* Session storage is optional. */
  }

  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) sessionId = crypto.randomUUID();

  try {
    sessionStorage.setItem("club-visit-session", sessionId);
  } catch {
    /* Use in-memory ID. */
  }

  // Editors, automated browsers and dev/preview hosts read the count without adding to it.
  const counts =
    pageOf(location.pathname).split("/")[0] !== "admin" &&
    !navigator.webdriver &&
    !/^(localhost|127\.|\[::1\]|id-preview--)|\.lovableproject\.com$/.test(location.hostname);

  request = recordClubVisit(counts ? sessionId : "00000000-0000-0000-0000-000000000000").catch(
    (error) => {
      request = undefined;
      throw error;
    },
  );

  return request;
}
