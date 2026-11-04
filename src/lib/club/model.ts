import { z } from "zod";

const visibleContent = (value: string) =>
  value
    .replace(/^::club-rich-text-v1::/, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(nbsp|#160);/gi, " ")
    .trim();

export const collections = ["members", "events", "news", "partners"] as const;

export type ContentCollection = (typeof collections)[number];

export type Lang = "ar" | "en";

/** The parent college's site, in each language. */
export const collegeUrl: Record<Lang, string> = {
  ar: "https://www.ucas.edu.ps/",
  en: "https://en.ucas.edu.ps/",
};

export type Content = {
  id: string;
  publicationStatus?: "draft" | "published";
  /** Readable URL name for news, events, partners, and member profiles. */
  slug?: string;
  title: string;
  title_en: string;
  description: string;
  description_en: string;
  category?: string;
  year?: number;
  date?: string;
  /** News and events: optional meta description; the body's opening is used otherwise. */
  summary?: string;
  summary_en?: string;
  images?: string[];
  /** Public Google Drive image URLs used by news and events. */
  driveImageUrls?: string[];
  technologies?: string[];
  memberIds?: string[];
  role?: string;
  role_en?: string;
  /** Whether visitors can open this member's individual profile page. */
  profileEnabled?: boolean;
  committee?: string;
  gender?: "male" | "female";
  isFounder?: boolean;
  displayOrder?: number;
  websiteUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  demoUrl?: string;
  apkUrl?: string;
  partnershipType?: string;
  partnershipType_en?: string;
  status?: string;
  /** Event-only local time, stored as 24-hour HH:MM. */
  eventTime?: string;
  /** Event-only duration in whole minutes. */
  durationMinutes?: number;
  eventType?: string;
  eventType_en?: string;
  presenterName?: string;
  presenterName_en?: string;
  presenterBio?: string;
  presenterBio_en?: string;
  eventRegistration?: EventRegistration;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type EventRegistration = {
  enabled: boolean;
  nameEnabled: boolean;
  phoneEnabled: boolean;
  attendanceEnabled: boolean;
};

export const defaultEventRegistration: EventRegistration = {
  enabled: false,
  nameEnabled: true,
  phoneEnabled: true,
  attendanceEnabled: true,
};

export const eventRegistrationSchema = z.object({
  enabled: z.boolean(),
  nameEnabled: z.boolean(),
  phoneEnabled: z.boolean(),
  attendanceEnabled: z.boolean(),
});

/** Details shown in the event information and presenter sections. */
export const eventDetailsSchema = z
  .object({
    eventTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    durationMinutes: z.coerce.number().int().min(1).max(1440),
    eventType: z.string().trim().min(2).max(100),
    eventType_en: z.string().trim().min(2).max(100),
    presenterName: z.string().trim().min(2).max(200),
    presenterName_en: z.string().trim().min(2).max(200),
    presenterBio: z.string().trim().min(2).max(500),
    presenterBio_en: z.string().trim().min(2).max(500),
  })
  .strict();

export const eventSignupSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    countryCode: z.enum(["970", "972"]).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\d{7,10}$/)
      .optional(),
    attendance: z.literal("yes").optional(),
  })
  .strict();

export type Settings = {
  /**
   * Whether the club is advertising membership right now.
   *
   * Mirrored here by the admin screen when it saves the Apps Script settings,
   * so public pages can show or hide the join prompt from the club payload
   * they already fetch. Apps Script stays authoritative — the join page asks
   * it directly — but nobody pays a ~3s third-party request to find out
   * whether to render a button.
   */
  registrationOpen?: boolean;
  /** Whether visitors can see or open the team section. Defaults to visible. */
  teamVisible?: boolean;
  vision: string;
  vision_en: string;
  mission: string;
  mission_en: string;
  goals: string;
  goals_en: string;
  email: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  github: string;
};

export const emptySettings: Settings = {
  teamVisible: true,
  vision: "",
  vision_en: "",
  mission: "",
  mission_en: "",
  goals: "",
  goals_en: "",
  email: "",
  facebook: "",
  instagram: "",
  linkedin: "",
  github: "",
};

export const labels: Record<ContentCollection, [string, string]> = {
  members: ["الفريق", "Team"],
  events: ["الفعاليات", "Events"],
  news: ["الأخبار", "News"],
  partners: ["الشراكات", "Partners"],
};

export const categories = [
  ["mobile", "تطبيقات الموبايل", "Mobile apps"],
  ["web", "مواقع الويب", "Websites"],
  ["games", "الألعاب", "Games"],
  ["multimedia", "الوسائط المتعددة", "Multimedia"],
] as const;

export const majors = [
  "تصميم و برمجة تطبيقات الموبايل",
  "تصميم و برمجة الألعاب الموبايل",
  "تصميم و برمجة صفحات الويب",
  "تكنولوجيا الوسائط المتعددة",
] as const;

export const majorEnglishLabels: Record<(typeof majors)[number], string> = {
  "تصميم و برمجة تطبيقات الموبايل": "Mobile Application Design and Programming",
  "تصميم و برمجة الألعاب الموبايل": "Mobile Game Design and Programming",
  "تصميم و برمجة صفحات الويب": "Web Page Design and Programming",
  "تكنولوجيا الوسائط المتعددة": "Multimedia Technology",
};

export const committees = [
  ["media", "الإعلام", "Media"],
  ["relations", "العلاقات العامة", "Public relations"],
  ["activities", "الأنشطة", "Activities"],
] as const;

export function local(
  item: Content,
  key: "title" | "description" | "role" | "partnershipType",
  lang: Lang,
) {
  return (lang === "en" ? item[`${key}_en`] : item[key]) || item[key] || "";
}

export function safeUrl(value: string | undefined) {
  if (!value) return undefined;

  try {
    const u = new URL(value);

    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

const text = z.string().trim().min(2).max(200);

export const contactSchema = z.object({
  name: text,
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(10).max(4000),
});

export const joinSchema = z.object({
  fullName: text,
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .regex(/@smail\.ucas\.edu\.ps$/),
  phone: z.string().regex(/^(?:05[69][0-9]{6,7})?$/),
  studentId: z
    .string()
    .trim()
    .regex(/^[0-9]{9}$/),
  major: z.enum(majors),
  preferredCommittee: z.enum(["media", "relations", "activities"]),
  message: z.string().trim().min(10).max(4000),
});

/**
 * A collection with nothing in it stays out of navigation and answers 404,
 * rather than being indexed as an empty page. Callers pass only loaded data;
 * an unloaded site has every list empty.
 */
export function isUnavailableSection(
  path: string,
  data: Record<ContentCollection, Content[]>,
  settings?: Pick<Settings, "teamVisible">,
) {
  // SAFETY: includes only needs the wider string type; the index below runs
  // only once includes has confirmed path is a collection.
  return (
    (path === "members" && settings?.teamVisible === false) ||
    ((collections as readonly string[]).includes(path) && !data[path as ContentCollection].length)
  );
}

/** Detail pages still open news and events links across the two kinds. */
export const kindsFor = (kind: ContentCollection): ContentCollection[] =>
  kind === "news" ? ["news", "events"] : kind === "events" ? ["events", "news"] : [kind];

/** Stable public numbering: articles oldest-first, then partners, with the board first on team. */
export function publicIndexOrder(items: Content[], kind: ContentCollection) {
  const created = (item: Content) => item.createdAt || item.date || item.id;

  return [...items].sort((a, b) => {
    if (kind === "events" || kind === "news") {
      const byDate = (a.date || a.createdAt || "").localeCompare(b.date || b.createdAt || "");
      return byDate || created(a).localeCompare(created(b)) || a.id.localeCompare(b.id);
    }

    if (kind === "members") {
      const boardA = a.isFounder || a.committee === "administrative" ? 0 : 1;
      const boardB = b.isFounder || b.committee === "administrative" ? 0 : 1;
      if (boardA !== boardB) return boardA - boardB;
      if (boardA === 0)
        return (
          (a.displayOrder ?? 10000) - (b.displayOrder ?? 10000) ||
          created(a).localeCompare(created(b)) ||
          a.id.localeCompare(b.id)
        );
      const committeeA = committees.findIndex(([key]) => key === a.committee);
      const committeeB = committees.findIndex(([key]) => key === b.committee);
      return (
        (committeeA < 0 ? committees.length : committeeA) -
          (committeeB < 0 ? committees.length : committeeB) ||
        created(a).localeCompare(created(b)) ||
        a.id.localeCompare(b.id)
      );
    }

    return created(a).localeCompare(created(b)) || a.id.localeCompare(b.id);
  });
}

export function publicItemIndex(
  data: Record<ContentCollection, Content[]>,
  kind: ContentCollection,
  item: Pick<Content, "id">,
) {
  return publicIndexOrder(data[kind], kind).findIndex((candidate) => candidate.id === item.id) + 1;
}

/** The item a URL names, by readable slug or by id, and the list it lives in. */
export function findItem(
  data: Record<ContentCollection, Content[]>,
  kind: ContentCollection,
  ref: string,
) {
  if (/^[1-9][0-9]*$/.test(ref)) {
    const item = publicIndexOrder(data[kind], kind)[Number(ref) - 1];
    if (item) return { kind, item };
  }

  for (const k of kindsFor(kind)) {
    const item = data[k].find((x) => x.slug === ref || x.id === ref);

    if (item) return { kind: k, item };
  }

  return undefined;
}

export function memberGender(item: Content): "male" | "female" {
  return item.gender === "female" ? "female" : "male";
}

export const contentSchema = z
  .object({
    driveImageUrls: z.array(z.string().url().max(500)).max(20).optional(),
    displayOrder: z.number().int().min(1).max(9999).optional(),
    gender: z.enum(["male", "female"]).optional(),
    title: text,
    title_en: text,
    description: z
      .string()
      .trim()
      .max(20000)
      .refine((value) => visibleContent(value).length >= 2),
    description_en: z
      .string()
      .trim()
      .max(20000)
      .refine((value) => visibleContent(value).length >= 2),
  })
  .passthrough();
