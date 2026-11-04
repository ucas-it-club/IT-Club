import logo from "@/assets/ucas-logo.webp";
import {
  collegeUrl,
  labels,
  local,
  type Content,
  type ContentCollection,
  type Lang,
} from "./model";
import { contentImageUrls } from "./google-drive";
import { hrefOf, pageOf } from "./paths";
import { plainRichText } from "./rich-text";

/**
 * Absolute origin for share tags; og:url and og:image must be absolute.
 *
 * ponytail: the workers.dev host until the club settles its own domain. Set
 * VITE_SITE_URL in the Cloudflare build settings then; no code change needed.
 */
export const siteUrl = (
  import.meta.env.VITE_SITE_URL || "https://ucas.itclub-143.workers.dev"
).replace(/\/$/, "");

/** The club's official name in each language; every other spelling is an alias. */
export const siteName: Record<Lang, string> = {
  ar: "النادي التكنولوجي",
  en: "UCAS IT Club",
};

type Copy = { title: string; description: string };

/**
 * The full <title> and meta description of every fixed page, per language.
 *
 * Home, about, team, events, news, join and contact use the marketing team's
 * approved copy word for word (SEO brief, 25 September 2026); edit it only
 * with them. The rest keep the "Page | Club" pattern.
 */
export const pages = {
  home: {
    ar: {
      title: "النادي التكنولوجي UCAS | نادي تكنولوجيا المعلومات",
      description:
        "النادي التكنولوجي في الكلية الجامعية للعلوم التطبيقية UCAS. نادٍ طلابي يديره طلبته، يجمع المهتمين بالبرمجة والتصميم والألعاب. تعرف على فعالياتنا وانضم إلينا.",
    },
    en: {
      title: "UCAS IT Club | Technology Club at UCAS",
      description:
        "UCAS IT Club is a student-run tech community at University College of Applied Sciences, focused on coding, design, and gaming. Join us today.",
    },
  },
  about: {
    ar: {
      title: "من نحن | رؤية ورسالة النادي التكنولوجي UCAS",
      description:
        "تعرف على رؤية النادي التكنولوجي UCAS ورسالته ولجانه الثلاث، ومجالات عمله: تطبيقات الموبايل، مواقع الويب، الألعاب، والوسائط المتعددة.",
    },
    en: {
      title: "About Us | UCAS IT Club Vision & Mission",
      description:
        "Discover UCAS IT Club's vision, mission, and committees — working across mobile apps, web development, games, and multimedia.",
    },
  },
  members: {
    ar: {
      title: "فريق النادي التكنولوجي UCAS | الأعضاء واللجان",
      description:
        "تعرف على فريق النادي التكنولوجي UCAS وأعضائه ولجانه الثلاث: الإعلام والعلاقات العامة والأنشطة. طلبة يديرون النادي بشغف وعمل جماعي.",
    },
    en: {
      title: "UCAS IT Club Team | Members & Committees",
      description:
        "Meet the UCAS IT Club team — student members across three committees: Media, Public Relations, and Activities. Run by students, for students.",
    },
  },
  events: {
    ar: {
      title: "فعاليات النادي التكنولوجي UCAS | الأنشطة والورش",
      description:
        "تابع فعاليات النادي التكنولوجي UCAS المتنوعة: ورش تقنية، مبادرات مجتمعية، وأنشطة طلابية قادمة وسابقة يشارك فيها طلبة الكلية.",
    },
    en: {
      title: "UCAS IT Club Events | Workshops & Activities",
      description:
        "Explore UCAS IT Club's diverse events: tech workshops, community initiatives, and student activities — upcoming and past.",
    },
  },
  news: {
    ar: {
      title: "أخبار النادي التكنولوجي UCAS | آخر المستجدات",
      description:
        "آخر أخبار النادي التكنولوجي UCAS: انتخابات الهيئة الإدارية، ترشيحات القيادة، وشراكات النادي مع عمادة تكنولوجيا المعلومات وغيرها من المستجدات.",
    },
    en: {
      title: "UCAS IT Club News | Latest Updates",
      description:
        "Stay updated with the latest UCAS IT Club news: board elections, leadership nominations, partnerships, and club announcements.",
    },
  },
  partners: {
    ar: {
      title: "الشراكات | النادي التكنولوجي",
      description: "الجهات التي يتعاون معها النادي التكنولوجي في الكلية الجامعية للعلوم التطبيقية.",
    },
    en: {
      title: "Partners | UCAS IT Club",
      description:
        "The organisations the UCAS IT Club works with at the University College of Applied Sciences.",
    },
  },
  join: {
    ar: {
      title: "انضم للنادي التكنولوجي UCAS | شروط التسجيل",
      description:
        "كل ما تحتاج معرفته عن الانضمام للنادي التكنولوجي UCAS: شروط العضوية، خطوات التقديم، ومواعيد فتح باب التسجيل عند توفرها.",
    },
    en: {
      title: "Join UCAS IT Club | Membership & How to Apply",
      description:
        "Everything you need to know about joining UCAS IT Club: membership requirements, application steps, and registration updates.",
    },
  },
  contact: {
    ar: {
      title: "تواصل معنا | النادي التكنولوجي UCAS",
      description:
        "تواصل مع النادي التكنولوجي UCAS عبر البريد الإلكتروني أو نموذج التواصل المباشر لأي استفسار أو تعاون أو اقتراح.",
    },
    en: {
      title: "Contact Us | UCAS IT Club",
      description:
        "Get in touch with UCAS IT Club via email or our contact form for inquiries, collaboration, or feedback.",
    },
  },
  privacy: {
    ar: {
      title: "الخصوصية والكوكيز | النادي التكنولوجي",
      description:
        "ما الذي يحفظه موقع النادي التكنولوجي، وكيف تُستخدم بيانات النماذج، وكيف تطلب حذفها.",
    },
    en: {
      title: "Privacy and cookies | UCAS IT Club",
      description:
        "What the UCAS IT Club site stores, how form data is used, and how to request deletion.",
    },
  },
  admin: {
    ar: {
      title: "الإدارة | النادي التكنولوجي",
      description: "لوحة إدارة محتوى النادي التكنولوجي.",
    },
    en: { title: "Admin | UCAS IT Club", description: "Content management for the UCAS IT Club." },
  },
  missing: {
    ar: {
      title: "الصفحة غير موجودة | النادي التكنولوجي",
      description: "الصفحة المطلوبة غير موجودة في موقع النادي التكنولوجي.",
    },
    en: {
      title: "Page not found | UCAS IT Club",
      description: "This page does not exist on the UCAS IT Club site.",
    },
  },
} satisfies Record<string, Record<Lang, Copy>>;

export type PageKey = keyof typeof pages;

/** Plain text trimmed at a word boundary, for a meta description. */
export function excerpt(text: string, max = 155) {
  const flat = plainRichText(text).replace(/\s+/g, " ").trim();

  if (flat.length <= max) return flat;

  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");

  // A long unbroken run (a URL) would cut to almost nothing; cut mid-word instead.
  return `${space > max / 2 ? cut.slice(0, space) : cut}…`;
}

type Meta = { title?: string; name?: string; property?: string; content?: string };

/**
 * Every tag a page needs to describe itself to search engines and link previews.
 *
 * Page routes spread this into their head; the router keeps the deepest route's
 * copy of each tag, so nothing from the root's defaults leaks through.
 */
export function seo({
  lang,
  title,
  description,
  path,
  image,
  published,
  modified,
  article = false,
  imageAlt,
  noindex = false,
}: {
  lang: Lang;
  title: string;
  description: string;
  path: string;
  image?: string | undefined;
  published?: string | undefined;
  modified?: string | undefined;
  article?: boolean;
  imageAlt?: string | undefined;
  noindex?: boolean;
}): Meta[] {
  const other: Lang = lang === "ar" ? "en" : "ar";
  const locale = (l: Lang) => (l === "ar" ? "ar_AR" : "en_US");

  return [
    { title },
    { name: "description", content: description },
    {
      name: "robots",
      content: noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large",
    },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: `${siteUrl}${path}` },
    { property: "og:type", content: article ? "article" : "website" },
    { property: "og:image", content: image ?? `${siteUrl}/og/default-${lang}.jpg` },
    { property: "og:image:alt", content: imageAlt ?? siteName[lang] },
    { name: "twitter:image:alt", content: imageAlt ?? siteName[lang] },
    { property: "og:site_name", content: siteName[lang] },
    { property: "og:locale", content: locale(lang) },
    { property: "og:locale:alternate", content: locale(other) },
    { name: "twitter:card", content: "summary_large_image" },
    ...(article && published ? [{ property: "article:published_time", content: published }] : []),
    ...(article && modified ? [{ property: "article:modified_time", content: modified }] : []),
  ];
}

/**
 * The page's own address plus its Arabic, English and default versions.
 *
 * Tells search engines the two languages are one page in two translations,
 * not duplicates, and which URL to index for each. x-default is Arabic, the
 * site's main language.
 */
export function alternates(lang: Lang, page: string) {
  const url = (l: Lang) => `${siteUrl}${hrefOf(l, page)}`;

  return [
    { rel: "canonical", href: url(lang) },
    { rel: "alternate", hrefLang: "ar", href: url("ar") },
    { rel: "alternate", hrefLang: "en", href: url("en") },
    { rel: "alternate", hrefLang: "x-default", href: url("ar") },
  ];
}

/** Tags for one news, event or member page, from the item itself. */
export function itemSeo(item: Content, lang: Lang, path: string, noindex: boolean) {
  const summary = lang === "en" ? item.summary_en || item.summary : item.summary;
  const article = pageOf(path).split("/")[0] === "news";
  const image = contentImageUrls(item)[0];

  return seo({
    lang,
    title: `${local(item, "title", lang)} | ${siteName[lang]}`,
    description: excerpt(summary?.trim() || local(item, "description", lang)),
    path,
    image,
    article,
    imageAlt: image ? local(item, "title", lang) : siteName[lang],
    published: article ? item.date : undefined,
    modified: article ? item.updatedAt : undefined,
    noindex,
  });
}

/**
 * A JSON-LD block for a route's head meta.
 *
 * The router renders a `script:ld+json` entry as a JSON-LD script tag and
 * escapes it for HTML (router-core headContentUtils), so titles typed by
 * editors cannot close the tag. Its React typings only list <meta> attributes.
 */
export function ldJson(data: object): Meta {
  // SAFETY: a shape the router renders at runtime, per the comment above.
  return { "script:ld+json": data } as unknown as Meta;
}

/** What the organisation markup may state, straight from the admin settings. */
export type Contact = { email?: string | undefined; profiles: string[] };

const orgId = () => `${siteUrl}/#org`;

/**
 * The club as schema.org data, on every page: who it is, its parent college,
 * how to reach it and where else it lives. Search engines and AI assistants
 * read this instead of guessing from prose. Only facts the site itself shows.
 */
export function organizationLd(lang: Lang, contact: Contact) {
  const other: Lang = lang === "ar" ? "en" : "ar";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId(),
        name: siteName[lang],
        alternateName: [siteName[other], "Technology Club", "نادي تكنولوجيا المعلومات"],
        url: `${siteUrl}${hrefOf(lang, "")}`,
        logo: `${siteUrl}${logo}`,
        ...(contact.email ? { email: contact.email } : {}),
        ...(contact.profiles.length ? { sameAs: contact.profiles } : {}),
        parentOrganization: {
          "@type": "CollegeOrUniversity",
          name:
            lang === "ar"
              ? "الكلية الجامعية للعلوم التطبيقية"
              : "University College of Applied Sciences",
          alternateName: "UCAS",
          url: collegeUrl[lang],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name: siteName[lang],
        alternateName: siteName[other],
        inLanguage: lang,
        publisher: { "@id": orgId() },
      },
    ],
  };
}

/**
 * A news, event or partner page as schema.org data: always its breadcrumb
 * trail, and for news the article itself. Events wait for a location field,
 * which Google requires of every Event.
 */
export function itemLd(item: Content, lang: Lang, path: string) {
  const page = pageOf(path);
  const [section = ""] = page.split("/");
  const url = `${siteUrl}${path}`;
  const title = local(item, "title", lang);
  // SAFETY: section comes from a validated page path, one of the collections.
  const sectionName = labels[section as ContentCollection]?.[lang === "ar" ? 0 : 1] ?? section;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: siteName[lang],
          item: `${siteUrl}${hrefOf(lang, "")}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: sectionName,
          item: `${siteUrl}${hrefOf(lang, section)}`,
        },
        { "@type": "ListItem", position: 3, name: title, item: url },
      ],
    },
  ];

  if (section === "news") {
    const images = contentImageUrls(item);
    graph.push({
      "@type": "NewsArticle",
      headline: title,
      description: excerpt(local(item, "description", lang)),
      ...(item.date ? { datePublished: item.date } : {}),
      ...(item.updatedAt ? { dateModified: item.updatedAt } : {}),
      ...(images.length ? { image: images } : {}),
      inLanguage: lang,
      mainEntityOfPage: url,
      author: {
        "@type": "Organization",
        "@id": orgId(),
        name: siteName[lang],
        url: `${siteUrl}${hrefOf(lang, "about")}`,
      },
      publisher: { "@id": orgId() },
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * robots.txt, generated so its Sitemap line follows VITE_SITE_URL.
 *
 * One group on purpose: a crawler obeys only the most specific group naming
 * it, so a Googlebot-only group would silently skip every rule written under *.
 */
// Crawlers must reach admin pages to read their noindex tags. RLS and Auth,
// not robots.txt, protect private data.
export const robotsTxt = () =>
  ["User-agent: *", "Allow: /", "", `Sitemap: ${siteUrl}/sitemap.xml`, ""].join("\n");

/** Public ownership tokens supplied by the site's search-console accounts. */
export function verificationMeta(): Meta[] {
  const google = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = import.meta.env.VITE_BING_SITE_VERIFICATION?.trim();
  return [
    ...(google ? [{ name: "google-site-verification", content: google }] : []),
    ...(bing ? [{ name: "msvalidate.01", content: bing }] : []),
  ];
}
