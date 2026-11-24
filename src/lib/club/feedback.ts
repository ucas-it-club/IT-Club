/** Site Feedback, as GLOSSARY.md names it. */
export type FeedbackKind = "bug" | "suggestion";
export type FeedbackStatus = "new" | "seen" | "done";

export type Feedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
  name: string | null;
  contact: string | null;
  page: string | null;
  lang: string | null;
  theme: string | null;
  device: string | null;
  status: FeedbackStatus;
  issue_url: string | null;
  created_at: string;
};

export const feedbackKinds: Record<FeedbackKind, [string, string]> = {
  bug: ["بلاغ عن مشكلة", "Bug report"],
  suggestion: ["اقتراح", "Suggestion"],
};

export const feedbackStatuses: Record<FeedbackStatus, [string, string]> = {
  new: ["جديدة", "New"],
  seen: ["مقروءة", "Seen"],
  done: ["منتهية", "Done"],
};

export const feedbackMaxLength = 2000;

/** Same rule as the club_feedback.issue_url check. */
export const isGithubIssueUrl = (url: string) =>
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[0-9]+$/.test(url);

/** Kind and status filters together; "all" leaves that side open. */
export const filterFeedback = (
  items: Feedback[],
  kind: FeedbackKind | "all",
  status: FeedbackStatus | "all",
) =>
  items.filter(
    (item) =>
      (kind === "all" || item.kind === kind) && (status === "all" || item.status === status),
  );

/**
 * Markdown for pasting into Claude. Never includes name or contact: the text
 * leaves the site, and the item ID leads back to the visitor if a reply is needed.
 */
export function feedbackMarkdown(items: Feedback[]) {
  const block = (item: Feedback) =>
    [
      `## Feedback ${item.id}`,
      "",
      `- Kind: ${feedbackKinds[item.kind][1]}`,
      `- Status: ${feedbackStatuses[item.status][1]}`,
      item.page ? `- Page: ${item.page}` : null,
      item.lang ? `- Language: ${item.lang}` : null,
      item.theme ? `- Theme: ${item.theme}` : null,
      item.device ? `- Device: ${item.device}` : null,
      `- Date: ${item.created_at}`,
      item.issue_url ? `- Issue: ${item.issue_url}` : null,
      "",
      // A quote block keeps the visitor's own Markdown from changing the layout.
      ...item.message.split(/\r?\n/).map((line) => (line ? `> ${line}` : ">")),
    ]
      .filter((line) => line !== null)
      .join("\n");
  return items.map(block).join("\n\n---\n\n") + "\n";
}

/** The page a visitor was on when they followed a feedback link; SPA navigation leaves document.referrer stale. */
let source = "";
export const rememberFeedbackSource = () => {
  source = location.pathname;
};

/** Takes the remembered page once; a direct visit falls back to a same-site referrer. */
export function takeFeedbackSource() {
  const from = source;
  source = "";
  if (from) return from;
  try {
    const referrer = new URL(document.referrer);
    if (referrer.origin === location.origin) return referrer.pathname;
  } catch {
    /* No referrer. */
  }
  return "";
}

const feedbackErrors: [string, string, string][] = [
  [
    "feedback_rate_limited",
    "أرسلت عدة ملاحظات خلال الساعة الأخيرة. حاول مرة أخرى لاحقًا.",
    "You have sent several notes in the last hour. Please try again later.",
  ],
  [
    "feedback_too_long",
    `الرسالة أطول من ${feedbackMaxLength} حرف.`,
    `The message is longer than ${feedbackMaxLength} characters.`,
  ],
  ["feedback_empty", "اكتب رسالتك أولًا.", "Write your message first."],
  ["feedback_rejected", "تعذر قبول الرسالة.", "The message could not be accepted."],
];

/** Bilingual message for an error thrown by club_send_feedback. */
export function feedbackError(error: unknown, ar: boolean) {
  const text = error instanceof Error ? error.message : "";
  const [, a, e] = feedbackErrors.find(([code]) => text.includes(code)) ?? [
    "",
    "تعذر الإرسال. تحقق من اتصالك وحاول مجددًا.",
    "Could not send. Check your connection and try again.",
  ];
  return ar ? a : e;
}
