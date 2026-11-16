export type Pair = readonly [ar: string, en: string];
/** `hint` is Arabic only: applicants answer in Arabic whatever language the page is in. */
type Base = { name: string; label: Pair; optional?: boolean; hint?: string };
export type Question =
  | (Base & { kind: "text"; props?: Record<string, unknown> })
  | (Base & { kind: "area"; rows?: number })
  | (Base & { kind: "chips"; options: readonly (readonly [key: string, ...Pair])[] })
  | (Base & { kind: "check" })
  | (Base & { kind: "phone" });
export type FormStep = { title: Pair; questions: readonly Question[] };
export type Committee = { id: string; name: Pair; blurb: Pair; steps: readonly FormStep[] };

/** Every applicant answers the same core questions, so reviewers compare people equally. */
export const aboutStep: FormStep = {
  title: ["بياناتك", "About you"],
  questions: [
    {
      kind: "text",
      name: "fullName",
      label: ["الاسم الكامل", "Full name"],
      props: { autoComplete: "name" },
    },
    {
      kind: "text",
      name: "studentId",
      label: ["الرقم الجامعي", "Student ID"],
      props: { inputMode: "numeric", pattern: "[0-9]{9}", maxLength: 9 },
    },
    { kind: "phone", name: "whatsapp", label: ["رقم الواتساب", "WhatsApp number"] },
    {
      kind: "text",
      name: "email",
      label: ["البريد الجامعي", "University email"],
      props: {
        type: "email",
        pattern: "[^@]+@smail\\.ucas\\.edu\\.ps",
        title: "name@smail.ucas.edu.ps",
        autoComplete: "email",
        dir: "ltr",
      },
    },
  ],
};

const commit: Question = {
  kind: "check",
  name: "commit",
  label: [
    "أتعهد بالتعلّم والعمل ضمن فريق والالتزام بالمهام والمواعيد.",
    "I commit to learning, working in a team, and meeting tasks and deadlines.",
  ],
};
const leadership: Question = {
  kind: "area",
  name: "leadership",
  hint: "مثال: قدت فريق مشروع التخرج ووزعت المهام على ٤ أعضاء",
  optional: true,
  rows: 3,
  label: ["هل قدت فريقاً من قبل؟ صف دورك باختصار.", "Ever led a team? Briefly describe your role."],
};

export const committees: readonly Committee[] = [
  {
    id: "media",
    name: ["الإعلام", "Media"],
    blurb: [
      "تصميم، تصوير، مونتاج وتغطية فعاليات النادي.",
      "Design, photo, video and event coverage.",
    ],
    steps: [
      {
        title: ["لماذا الإعلام؟", "Why media"],
        questions: [
          {
            kind: "area",
            name: "why",
            hint: "اكتب بحرية: ما الذي يشدك للعمل الإعلامي في النادي؟",
            label: [
              "لماذا ترغب بالانضمام إلى لجنة الإعلام؟",
              "Why do you want to join the media committee?",
            ],
          },
          {
            kind: "area",
            name: "skills",
            hint: "مثال: أجيد فوتوشوب وكانفا، وأصور بالجوال بجودة جيدة",
            label: [
              "ما مهاراتك المفيدة للجنة، وماذا ستقدم للنادي؟",
              "Which skills do you bring, and what will you give the club?",
            ],
          },
        ],
      },
      {
        title: ["مجالك", "Your role"],
        questions: [
          {
            kind: "chips",
            name: "roles",
            label: ["اختر مجالاً أو أكثر", "Pick one or more"],
            options: [
              ["graphic", "التصميم الجرافيكي", "Graphic design"],
              ["photo", "التصوير الفوتوغرافي", "Photography"],
              ["video", "تصوير الفيديو", "Videography"],
              ["editing", "المونتاج", "Video editing"],
              ["writing", "كتابة المحتوى", "Content writing"],
              ["social", "إدارة التواصل الاجتماعي", "Social media"],
              ["coverage", "التغطية الإعلامية", "Event coverage"],
              ["marketing", "التسويق", "Marketing"],
              ["presenter", "وجه إعلامي", "On-camera presenter"],
              ["voice", "معلق صوتي", "Voice-over"],
              ["other", "أخرى", "Other"],
            ],
          },
          {
            kind: "area",
            name: "experience",
            hint: "مثال: صممت منشورات لفعالية في الجامعة، أو «لا»",
            rows: 3,
            label: [
              "خبرتك السابقة في هذا المجال؟ (اكتب «لا» إن لم توجد)",
              "Any experience in it? (write “none” if not)",
            ],
          },
          {
            kind: "text",
            name: "portfolio",
            hint: "https://",
            optional: true,
            label: ["رابط أعمالك", "Portfolio link"],
            props: { type: "url", dir: "ltr" },
          },
        ],
      },
      { title: ["العمل الجماعي", "Teamwork"], questions: [leadership, commit] },
    ],
  },
  {
    // DRAFT: the real public-relations questions were not received. Replace before launch.
    id: "relations",
    name: ["العلاقات العامة", "Public relations"],
    blurb: [
      "التواصل مع الشركاء والجامعات والجهات، واستقبال الضيوف.",
      "Partners, universities, outreach and hosting guests.",
    ],
    steps: [
      {
        title: ["لماذا العلاقات العامة؟", "Why public relations"],
        questions: [
          {
            kind: "area",
            name: "why",
            hint: "اكتب بحرية: ما الذي يشدك للعلاقات العامة؟",
            label: [
              "لماذا ترغب بالانضمام إلى لجنة العلاقات العامة؟",
              "Why do you want to join the public relations committee?",
            ],
          },
          {
            kind: "area",
            name: "skills",
            hint: "مثال: أتواصل بسهولة مع الناس وأقنعهم وأتابع الرسائل بسرعة",
            label: [
              "ما مهاراتك في التواصل والإقناع، وماذا ستقدم للنادي؟",
              "What communication and persuasion skills do you bring, and what will you give the club?",
            ],
          },
        ],
      },
      {
        title: ["مجالك", "Your role"],
        questions: [
          {
            kind: "chips",
            name: "roles",
            label: ["اختر مجالاً أو أكثر", "Pick one or more"],
            options: [
              ["partners", "التواصل مع الشركاء والرعاة", "Partners & sponsors"],
              ["universities", "التواصل مع الجامعات والأندية", "Universities & clubs"],
              ["hosting", "استقبال الضيوف والبروتوكول", "Hosting & protocol"],
              ["events", "تنظيم الفعاليات", "Event organising"],
              ["members", "العلاقة مع الأعضاء", "Member relations"],
              ["negotiation", "التفاوض", "Negotiation"],
              ["other", "أخرى", "Other"],
            ],
          },
          {
            kind: "area",
            name: "experience",
            hint: "مثال: شاركت في تنظيم فعالية أو استقبلت ضيوفاً، أو «لا»",
            rows: 3,
            label: [
              "هل لديك تجربة سابقة في التواصل أو تنظيم الفعاليات؟ (اكتب «لا» إن لم توجد)",
              "Any experience in outreach or organising events? (write “none” if not)",
            ],
          },
        ],
      },
      { title: ["العمل الجماعي", "Teamwork"], questions: [leadership, commit] },
    ],
  },
];
