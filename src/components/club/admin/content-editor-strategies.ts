import { ensureEventSheet } from "@/lib/club/sheets";
import {
  eventDetailsSchema,
  type Content,
  type ContentCollection,
  type EventRegistration,
} from "@/lib/club/model";

export type ContentEditorField = {
  key: keyof Content;
  ar: string;
  en: string;
  type: string;
};

export type ContentEditorContext = {
  ar: boolean;
  values: Record<string, string>;
  committee: string;
  gender: "male" | "female";
  status: string;
  eventRegistration: EventRegistration;
};

export type ContentEditorStrategy = {
  article?: boolean;
  initialArticleKind?: "events" | "news";
  member?: boolean;
  partner?: boolean;
  event?: boolean;
  fields: (ar: boolean) => ContentEditorField[];
  buildData: (context: ContentEditorContext) =>
    | { data: Partial<Content> }
    | { error: string };
  afterSave?: (id: string, content: Omit<Content, "id">) => Promise<void>;
  sanitizeUpdated?: (content: Content) => void;
  getSaveError?: (error: unknown, ar: boolean) => string | undefined;
};

const fields: {
  members: (ar: boolean) => ContentEditorField[];
  partners: () => ContentEditorField[];
  article: (ar: boolean, news: boolean) => ContentEditorField[];
} = {
  members: (ar: boolean) => [
    { key: "githubUrl", ar: "رابط GitHub", en: "GitHub URL", type: "url" },
    { key: "linkedinUrl", ar: "رابط LinkedIn", en: "LinkedIn URL", type: "url" },
  ],
  partners: () => [
    { key: "partnershipType", ar: "نوع الشراكة بالعربية", en: "Partnership type in Arabic", type: "text" },
    {
      key: "partnershipType_en",
      ar: "نوع الشراكة بالإنجليزية",
      en: "Partnership type in English",
      type: "text",
    },
    { key: "websiteUrl", ar: "موقع الشريك", en: "Partner website", type: "url" },
  ],
  article: (ar: boolean, news: boolean) => [
    {
      key: "date",
      ar: news ? "تاريخ الخبر" : "موعد الفعالية",
      en: news ? "News date" : "Event date",
      type: "date",
    },
  ],
};

const articleData = ({ values }: ContentEditorContext): Partial<Content> => {
  const data: Partial<Content> = { date: values["date"] || "" };
  for (const key of ["summary", "summary_en"] as const) {
    const summary = values[key]?.trim();
    if (summary) data[key] = summary;
  }
  return data;
};

const strategies: Record<ContentCollection, ContentEditorStrategy> = {
  members: {
    member: true,
    fields: fields.members,
    buildData: ({ values, committee, gender, ar }) => {
      const data: Partial<Content> = {
        role: values["role"] || "",
        role_en: values["role_en"] || "",
        profileEnabled: values["profileEnabled"] === "on",
        committee,
        gender,
        isFounder: committee === "administrative",
      };
      if (data.isFounder && values["boardOrder"]?.trim()) {
        const order = Number(values["boardOrder"]);
        if (!Number.isInteger(order) || order < 1 || order > 9999) {
          return {
            error: ar
              ? "ترتيب العرض يجب أن يكون رقمًا صحيحًا من 1 إلى 9999."
              : "Display order must be an integer from 1 to 9999.",
          };
        }
        data.displayOrder = order;
      }
      return { data };
    },
    getSaveError: (error, ar) =>
      error instanceof Error && error.message.includes("club_members_data_check")
        ? ar
          ? "قاعدة البيانات ترفض بيانات العضو. تأكد من تشغيل تحديث ترتيب الهيئة الإدارية في Supabase."
          : "The database rejected member data. Check that the board order migration has been applied in Supabase."
        : undefined,
  },
  events: {
    article: true,
    initialArticleKind: "events",
    event: true,
    fields: (ar) => fields.article(ar, false),
    buildData: (context) => {
      const eventDetails = eventDetailsSchema.safeParse({
        eventTime: context.values["eventTime"],
        durationMinutes: Number(context.values["durationHours"]) * 60,
        eventType: context.values["eventType"],
        eventType_en: context.values["eventType_en"],
        presenterName: context.values["presenterName"],
        presenterName_en: context.values["presenterName_en"],
        presenterBio: context.values["presenterBio"],
        presenterBio_en: context.values["presenterBio_en"],
      });
      if (!eventDetails.success) {
        return {
          error: context.ar
            ? "أكمل معلومات الفعالية والمقدم. يجب أن تكون المدة بين ربع ساعة و24 ساعة."
            : "Complete the event and presenter details. Duration must be between 0.25 and 24 hours.",
        };
      }
      return {
        data: {
          ...articleData(context),
          ...eventDetails.data,
          status: context.status,
          eventRegistration: context.eventRegistration,
        },
      };
    },
    afterSave: async (id, content) => {
      if (content.status === "upcoming" && content.eventRegistration?.enabled) {
        await ensureEventSheet(id, content.title);
      }
    },
  },
  news: {
    article: true,
    initialArticleKind: "news",
    fields: (ar) => fields.article(ar, true),
    buildData: (context) => ({ data: articleData(context) }),
    sanitizeUpdated: (content) => {
      delete content.status;
    },
  },
  partners: {
    partner: true,
    fields: fields.partners,
    buildData: ({ values }) => ({
      data: {
        partnershipType: values["partnershipType"] || "",
        partnershipType_en: values["partnershipType_en"] || "",
      },
    }),
  },
};

export function contentEditorStrategy(kind: ContentCollection): ContentEditorStrategy {
  return strategies[kind];
}
