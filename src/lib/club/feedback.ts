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

/** The page a visitor was on when they followed a feedback link; SPA navigation leaves document.referrer stale. */
let source = "";
export const rememberFeedbackSource = () => {
  source = location.pathname;
};
export const feedbackSource = () => source;

/** Bilingual message for an error thrown by club_send_feedback. */
export function feedbackError(error: unknown, ar: boolean) {
  const text = error instanceof Error ? error.message : "";
  const [a, e] = text.includes("feedback_rate_limited")
    ? [
        "أرسلت عدة ملاحظات خلال الساعة الأخيرة. حاول مرة أخرى لاحقًا.",
        "You have sent several notes in the last hour. Please try again later.",
      ]
    : text.includes("feedback_too_long")
      ? [
          `الرسالة أطول من ${feedbackMaxLength} حرف.`,
          `The message is longer than ${feedbackMaxLength} characters.`,
        ]
      : text.includes("feedback_empty")
        ? ["اكتب رسالتك أولًا.", "Write your message first."]
        : text.includes("feedback_rejected")
          ? ["تعذر قبول الرسالة.", "The message could not be accepted."]
          : [
              "تعذر الإرسال. تحقق من اتصالك وحاول مجددًا.",
              "Could not send. Check your connection and try again.",
            ];
  return ar ? a : e;
}
