# Moving the site to the college subdomain

What to do when the college gives the club a subdomain of `ucas.edu.ps` (this guide uses `itclub.ucas.edu.ps`; replace it with the name you actually get).

**Where things stand (24 Sep 2026)**

- The site runs on the Cloudflare Worker `ucas` in the club's Cloudflare account (`itclub@ucas.edu.ps`), at `https://ucas.itclub-143.workers.dev`.
- `ucas.edu.ps` is hosted on Cloudflare too, but in the **college's** account (nameservers `cass.ns.cloudflare.com` and `theo.ns.cloudflare.com`).
- `itclub.ucas.edu.ps` does not exist yet.

---

## 1. Why we can't just add the subdomain to our Cloudflare

Two Cloudflare rules block the obvious plan:

1. A Worker can only be attached to a hostname inside a zone **owned by the same account** ([Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)). `itclub.ucas.edu.ps` lives in the college's `ucas.edu.ps` zone, not ours.
2. Adding a subdomain as its own zone in another account ("subdomain setup") is **Enterprise-only** ([subdomain setup](https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/)). The club is on the Free plan.

A plain CNAME from the college to `ucas.itclub-143.workers.dev` does not work either: Cloudflare refuses to serve one account's `workers.dev` under another account's hostname.

So one of the two routes below is needed.

## 2. Choose a route

|                                           | **Route A: we host it (recommended)**                                            | **Route B: the college hosts it**                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| How                                       | Cloudflare for SaaS on a domain the club owns; the college points `itclub` at it | The college runs our Worker in their own Cloudflare account        |
| Who controls deploys, settings, rollbacks | The club                                                                         | College IT (or club members they invite)                           |
| Cost                                      | A domain the club owns (about $10/year); the first 100 custom hostnames are free | Free                                                               |
| What the college does                     | Adds 3 DNS records, once                                                         | Creates and maintains the Worker, build settings and custom domain |

Route A matches the plan of keeping the site on our Cloudflare. The rest of this guide assumes Route A; Route B is summarised in section 4.

---

## 3. Route A, step by step

### 3.1 Before asking the college

In the club's Cloudflare account:

1. **Own a domain and add it as a zone.** Any domain works, and it never has to be shown to visitors (for example `ucasitclub.com`, bought through Cloudflare Registrar). Wait until the zone shows **Active**.
2. **Enable Cloudflare for SaaS** on that zone: _SSL/TLS → Custom Hostnames → Enable_. Cloudflare may ask for a payment method even though the first 100 hostnames are free ([plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/)).
3. **Create the fallback origin.** Add this DNS record, then set `origin.<club-domain>` as the fallback origin on the Custom Hostnames page:

   | Type | Name     | Content | Proxy   |
   | ---- | -------- | ------- | ------- |
   | AAAA | `origin` | `100::` | Proxied |

4. **Send that zone's traffic to the Worker.** _Workers Routes → Add route_: route `*/*`, Worker `ucas` ([Worker as origin](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/)).
5. **Add the custom hostname** `itclub.ucas.edu.ps`, with **TXT** as the validation method. Cloudflare then shows the records the college must add.

### 3.2 What to send the college

Ask their IT team to add these records to the `ucas.edu.ps` zone (copy the TXT values exactly from the Custom Hostnames page):

| Type  | Name                         | Content                                   | Proxy                     |
| ----- | ---------------------------- | ----------------------------------------- | ------------------------- |
| CNAME | `itclub`                     | `origin.<club-domain>`                    | **DNS only (grey cloud)** |
| TXT   | `_cf-custom-hostname.itclub` | _value shown by Cloudflare_               | –                         |
| TXT   | `_acme-challenge.itclub`     | _value shown by Cloudflare_ (certificate) | –                         |

Ask for **DNS only**. If the college proxies the CNAME (orange cloud), their zone's settings (WAF, bot blocking, managed robots.txt) apply to our traffic before ours do ([O2O](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/saas-customers/how-it-works/)). If they insist on proxying, section 5.3 applies to their zone as well.

### 3.3 Wait for both to turn Active

On the Custom Hostnames page, both the hostname status and the certificate status must read **Active**. Then `https://itclub.ucas.edu.ps` serves the site. Continue with section 5.

---

## 4. Route B in short

College IT, in their Cloudflare account:

1. Create a Worker and connect it to the GitHub repository `hala-dalloul/IT-Club`, branch `master` (Workers Builds, same settings as our `ucas` Worker).
2. Add the build variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SITE_URL` (section 5.1).
3. Add `itclub.ucas.edu.ps` as a **Custom Domain** on that Worker.

Every later infrastructure change (settings, rollbacks, secrets) then goes through them, unless they invite club members into their account.

---

## 5. After the domain answers (both routes), in order

### 5.1 Point the site at its new address

In the Worker's **build** variables (_Workers & Pages → ucas → Settings → Build → Variables_; these are read at build time, not runtime), set:

```
VITE_SITE_URL=https://itclub.ucas.edu.ps
```

Then trigger a new deployment (a push to `master`, or _Retry build_). No code change is needed. This single value switches:

- canonical and `hreflang` links on every page
- link previews (`og:url`, `og:image`)
- the sitemap's addresses, and the `Sitemap:` line in robots.txt
- the structured data (organisation, website, articles, breadcrumbs)

### 5.2 The old workers.dev address

Nothing to do: this is already built in (`permanentMove` in `src/server.ts`). Once 5.1 is deployed, every page request to `ucas.itclub-143.workers.dev` gets a permanent (301) redirect to the same path on the new domain, so old shared links keep working and search engines move their records across.

- Keep the workers.dev route **enabled** in the Worker's settings. Turning it off would break old links instead of redirecting them.
- Cloudflare's per-version preview URLs (`<version>-ucas.itclub-143.workers.dev`) are not redirected, so they still work for testing.

### 5.3 Cloudflare settings on the zone that serves the site

This is the club's SaaS zone for Route A, or the college's zone for Route B or a proxied CNAME:

- [ ] **SSL/TLS → Edge Certificates → Always Use HTTPS**: on.
- [ ] **HSTS**: on, starting with a short max-age (1 day) and raising it once everything works. Do not turn on preload.
- [ ] **Security headers** through _Rules → Transform Rules → Response Header_, for the hostname:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: SAMEORIGIN` (stops other sites framing the admin panel)
- [ ] **Managed robots.txt**: off. The site generates its own robots.txt; Cloudflare's version would replace or prepend to it. Look under _AI Crawl Control_ or _Security → Settings → Bot traffic_ (Cloudflare renames these menus).
- [ ] **Block AI bots**: set to do not block. The club decided to let AI assistants read the site; blocking happens at the edge, whatever robots.txt says.

### 5.4 Services outside Cloudflare

- **Supabase**: nothing is required. The admin login is password-only, and the database and storage accept any origin. Optionally set _Authentication → URL Configuration → Site URL_ to the new address, which only matters if password-reset emails are ever used.
- **Google Sheets forms** (join and contact): the Apps Script does not check where requests come from. Still send one test submission of each form from the new address.

### 5.5 Search engines

- [ ] **Google Search Console**: add a **URL-prefix** property for `https://itclub.ucas.edu.ps/` and verify it with the **HTML file** method. A developer adds the file Google gives you to `public/` and pushes it. The DNS TXT method does not fit here: a TXT record cannot sit on the same name as the `itclub` CNAME.
- [ ] Submit `https://itclub.ucas.edu.ps/sitemap.xml` in Search Console.
- [ ] **Bing Webmaster Tools**: import the site from Search Console.

### 5.6 Links

- [ ] Ask the college to link to the club site from `ucas.edu.ps` (for example its student-activities page).
- [ ] Put the new address in the LinkedIn, Instagram and Facebook bios.
- [ ] Update the addresses in `README.md` and `docs/cloudflare-pages.md`.

---

## 6. Checks after the switch

Run each command and compare with the expected result.

```bash
curl -s https://itclub.ucas.edu.ps/robots.txt
```

Starts with `User-agent: *` and ends with `Sitemap: https://itclub.ucas.edu.ps/sitemap.xml`. Text starting with "# As a condition of accessing this website…" means Cloudflare's managed robots.txt is still on (5.3).

```bash
curl -s https://itclub.ucas.edu.ps/sitemap.xml | head -5
```

XML whose addresses all start with `https://itclub.ucas.edu.ps/`.

```bash
curl -s https://itclub.ucas.edu.ps/about | grep -o '<link rel="canonical"[^>]*>'
```

Points at `https://itclub.ucas.edu.ps/about`. A workers.dev address means 5.1 hasn't taken effect; check that the build ran after the variable was set.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -A "GPTBot/1.1" https://itclub.ucas.edu.ps/
```

`200`. A `403` means AI bots are blocked (5.3). This is a rough check only; Search Console is the reliable signal.

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://itclub.ucas.edu.ps/
```

`301` to the `https://` address (Always Use HTTPS).

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://ucas.itclub-143.workers.dev/about
```

`301` to `https://itclub.ucas.edu.ps/about` (the built-in redirect from 5.2).

Then paste a news address into [Google's Rich Results Test](https://search.google.com/test/rich-results), and open one page from each language on a phone.

## 7. Thirty days later

Search and AI results move slowly; nothing measurable changes before about a month. Then check:

- Search Console → Pages: indexed pages in both languages, and no unexpected errors.
- The same two searches the SEO audit used ("UCAS IT Club Gaza" and "النادي التكنولوجي الكلية الجامعية للعلوم التطبيقية"), to see whether the club now appears.
