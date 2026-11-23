import { expect, test, type Page } from "@playwright/test";

// Skip the boot screen: it covers the page until the app has loaded once per tab.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("ucas-boot", "1"));
});

/** The heading is the element actually on top at its own centre, so nothing covers it (#61). */
async function headingOnTop(page: Page) {
  const heading = page.locator("#contact-heading");
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  const onTop = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest("#contact-heading") !== null,
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  );
  expect(onTop).toBe(true);
}

const pages = [
  { path: "/contact", lang: "ar", dir: "rtl", heading: "خلّينا على تواصل", action: "راسلنا" },
  {
    path: "/en/contact",
    lang: "en",
    dir: "ltr",
    heading: "Let’s stay in touch",
    action: "Message us",
  },
] as const;

for (const p of pages) {
  test(`${p.path} renders in ${p.lang} (${p.dir})`, async ({ page }) => {
    await page.goto(p.path);

    await expect(page.locator("html")).toHaveAttribute("lang", p.lang);
    await expect(page.locator("html")).toHaveAttribute("dir", p.dir);
    await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
    await headingOnTop(page);

    // Instagram, Facebook, LinkedIn; email is added only when settings has one.
    const bands = page.locator(".contact-band-link");
    expect(await bands.count()).toBeGreaterThanOrEqual(3);

    // The call to action sits at the reading end of the band: left in Arabic, right in English.
    const first = bands.first();
    await expect(first.locator(".contact-band-action")).toContainText(p.action);
    const name = await first.locator(".contact-band-name").boundingBox();
    const action = await first.locator(".contact-band-action").boundingBox();
    expect(name && action).toBeTruthy();
    if (p.dir === "rtl") expect(action!.x + action!.width).toBeLessThanOrEqual(name!.x);
    else expect(action!.x).toBeGreaterThanOrEqual(name!.x + name!.width);
  });
}
