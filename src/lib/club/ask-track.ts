/**
 * Anonymous counts for the unlisted /ask page on the club's GoatCounter account
 * (same one as the quote-card page). No cookies, no script tag: the same beacon count.js sends.
 * A name with a leading "/" is a page visit; any other name is an event.
 * Open the page once with ?test and this browser stops counting; ?test=off counts it again.
 */
const GOATCOUNTER = "https://abdalrahmanpy.goatcounter.com/count";
const TEST_KEY = "gcTest";

export function isTestMode(): boolean {
  try {
    const flag = new URLSearchParams(location.search).get("test");

    if (flag === "off") localStorage.removeItem(TEST_KEY);
    else if (flag !== null) localStorage.setItem(TEST_KEY, "1");

    return localStorage.getItem(TEST_KEY) === "1";
  } catch {
    return false; // storage blocked: counts as usual
  }
}

export function track(name: string, skip = false): void {
  if (
    skip ||
    /^(localhost|127\.|\[::1\]|id-preview--)|\.lovableproject\.com$/.test(location.hostname)
  )
    return;

  const query = new URLSearchParams({ p: name, rnd: Math.random().toString(36).slice(2) });

  if (!name.startsWith("/")) query.set("e", "1");
  else if (document.referrer) query.set("r", document.referrer);

  const url = `${GOATCOUNTER}?${query}`;

  try {
    if (navigator.sendBeacon?.(url)) return;
  } catch {
    /* fall through to the image request */
  }
  new Image().src = url;
}
