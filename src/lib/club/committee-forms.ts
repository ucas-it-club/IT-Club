export type Pair = readonly [ar: string, en: string];
/** `hint` is Arabic only: applicants answer in Arabic whatever language the page is in. */
type Base = {
  name: string;
  label: Pair;
  optional?: boolean;
  hint?: string;
  showWhen?: readonly [string, string];
};
export type Question =
  | (Base & { kind: "text"; props?: Record<string, unknown> })
  | (Base & { kind: "area"; rows?: number })
  | (Base & { kind: "chips"; options: readonly (readonly [key: string, ...Pair])[] })
  | (Base & { kind: "check" })
  | (Base & { kind: "radio"; options: readonly (readonly [key: string, ...Pair])[] })
  | (Base & { kind: "study" })
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
      label: ["الاسم الرباعي", "Full name"],
      props: { autoComplete: "name" },
    },
    {
      kind: "text",
      name: "studentId",
      label: ["الرقم الجامعي", "Student ID"],
      props: { inputMode: "numeric", maxLength: 9 },
    },
    { kind: "study", name: "study", label: ["التخصص والسنة الدراسية", "Major and study year"] },
    { kind: "phone", name: "whatsapp", label: ["رقم الواتساب", "WhatsApp number"] },
    {
      kind: "text",
      name: "email",
      label: ["البريد الجامعي", "University email"],
      props: {
        type: "email",
        autoComplete: "email",
        dir: "ltr",
      },
    },
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
    id: "activities",
    name: ["الأنشطة", "Activities"],
    blurb: [
      "التخطيط للورش والفعاليات وتنظيمها ومتابعتها.",
      "Plan, organise and support workshops and events.",
    ],
    steps: [
      {
        title: ["الدافع والمهارات", "Motivation and skills"],
        questions: [
          {
            kind: "area",
            name: "why",
            label: [
              "لماذا ترغب في الانضمام إلى لجنة الأنشطة في نادي تكنولوجيا المعلومات؟",
              "Why do you want to join the Activities Committee?",
            ],
            rows: 4,
          },
          {
            kind: "area",
            name: "contribution",
            label: [
              "ما الذي تعتقد أنك تستطيع إضافته للجنة؟",
              "What do you think you can contribute to the committee?",
            ],
            rows: 4,
          },
          {
            kind: "area",
            name: "skills",
            label: [
              "ما المهارات أو الخبرات التي تمتلكها ويمكن أن تساعدك في العمل داخل اللجنة؟",
              "What skills or experience can help you work in the committee?",
            ],
            hint: "يمكنك ذكر مهاراتك الشخصية أو التقنية أو التنظيمية، حتى لو لم تكن لديك خبرة تطوعية سابقة.",
            rows: 4,
          },
        ],
      },
      {
        title: ["المهارات والاهتمامات", "Skills and interests"],
        questions: [
          {
            kind: "radio",
            name: "hasExperience",
            label: [
              "هل سبق لك المشاركة في تنظيم أنشطة أو فعاليات أو أعمال تطوعية؟",
              "Have you helped organise activities, events or volunteer work before?",
            ],
            options: [
              ["yes", "نعم", "Yes"],
              ["no", "لا", "No"],
            ],
          },
          {
            kind: "area",
            name: "experience",
            showWhen: ["hasExperience", "yes"],
            label: [
              "إذا كانت إجابتك نعم، اذكر طبيعة مشاركتك وما المهام التي توليتها.",
              "If yes, describe your participation and responsibilities.",
            ],
            rows: 3,
          },
          {
            kind: "chips",
            name: "roles",
            label: [
              "ما المجالات التي تميل إلى العمل فيها داخل لجنة الأنشطة؟",
              "Which areas would you prefer to work in?",
            ],
            options: [
              ["ideas", "التخطيط واقتراح الأفكار.", "Planning and proposing ideas"],
              ["events", "تنظيم الورش والفعاليات.", "Organising workshops and events"],
              [
                "coordination",
                "التنسيق والتواصل مع المدربين والضيوف.",
                "Coordinating with trainers and guests",
              ],
              ["hosting", "الاستقبال والضيافة.", "Reception and hospitality"],
              [
                "logistics",
                "تجهيز القاعات والاحتياجات اللوجستية.",
                "Venue and logistics preparation",
              ],
              ["registration", "إدارة الحضور والتسجيل.", "Attendance and registration"],
              ["documentation", "التوثيق والمتابعة.", "Documentation and follow-up"],
              [
                "flexible",
                "لا أمتلك تفضيلًا محددًا، ومستعد للتعلم والعمل في مجالات مختلفة.",
                "No fixed preference; willing to learn and help in different areas",
              ],
            ],
          },
        ],
      },
      {
        title: ["الالتزام والمسؤولية", "Commitment and responsibility"],
        questions: [
          {
            kind: "radio",
            name: "commitment",
            label: [
              "ما مدى قدرتك على الالتزام بالاجتماعات والمهام والمواعيد إلى جانب دراستك؟",
              "How well can you meet attendance and deadlines alongside your studies?",
            ],
            options: [
              ["full", "أستطيع الالتزام بشكل كامل.", "I can fully commit"],
              [
                "organised",
                "أستطيع الالتزام مع تنظيم وقتي.",
                "I can commit with good time management",
              ],
              ["difficulty", "قد أواجه صعوبة في بعض الفترات.", "I may struggle at some times"],
              ["unsure", "لست متأكدًا من قدرتي على الالتزام.", "I am not sure"],
            ],
          },
          {
            kind: "radio",
            name: "hours",
            label: [
              "كم ساعة تقريبًا تستطيع تخصيصها أسبوعيًا للعمل في اللجنة؟",
              "About how many hours per week can you give the committee?",
            ],
            options: [
              ["lt2", "أقل من ساعتين.", "Less than 2 hours"],
              ["2to4", "من ساعتين إلى 4 ساعات.", "2 to 4 hours"],
              ["4to6", "من 4 إلى 6 ساعات.", "4 to 6 hours"],
              ["gt6", "أكثر من 6 ساعات.", "More than 6 hours"],
              ["variable", "حسب طبيعة المهام والفعاليات.", "Depends on tasks and events"],
            ],
          },
          {
            kind: "area",
            name: "lateTask",
            label: [
              "إذا اكتشفت أنك لن تتمكن من تسليم مهمة في موعدها، كيف ستتصرف؟",
              "What would you do if you could not finish a task on time?",
            ],
            rows: 4,
          },
          {
            kind: "area",
            name: "outsidePreference",
            label: [
              "إذا طُلب منك تنفيذ مهمة لا توافق مجال تفضيلك، كيف ستتعامل معها؟ ولماذا؟",
              "How would you handle a task outside your preferred area, and why?",
            ],
            rows: 4,
          },
        ],
      },
      {
        title: ["التفكير والمبادرة", "Ideas and initiative"],
        questions: [
          {
            kind: "area",
            name: "eventIdea",
            label: [
              "اقترح فعالية لطلاب تكنولوجيا المعلومات، وما الفائدة المتوقعة منها؟",
              "Suggest an event for IT students and its expected benefit.",
            ],
            rows: 4,
          },
          {
            kind: "area",
            name: "workshopPrep",
            label: [
              "ما الأمور التي ينبغي الاستعداد لها قبل ورشة طلابية لضمان تنظيمها جيدًا؟",
              "What should be prepared before a student workshop to ensure it runs well?",
            ],
            hint: "لا يُشترط أن تكون لديك خبرة سابقة في تنظيم الورش. نريد معرفة كيف تفكر وما الأمور التي ستنتبه إليها.",
            rows: 5,
          },
          {
            kind: "area",
            name: "initiative",
            label: [
              "إذا لاحظت مشكلة أو نقصًا في التحضيرات ولم يطلب منك أحد التدخل، كيف ستتصرف؟",
              "If you notice a preparation issue and no one asks you to help, what would you do?",
            ],
            rows: 4,
          },
        ],
      },
      {
        title: ["العمل الجماعي والمواقف", "Teamwork and situations"],
        questions: [
          {
            kind: "area",
            name: "teamIssue",
            label: [
              "إذا لاحظت أن عضوًا لا يلتزم بمهامه ويؤثر ذلك على الفريق، كيف ستتعامل؟",
              "How would you handle a teammate missing tasks and affecting the team?",
            ],
            rows: 4,
          },
          {
            kind: "area",
            name: "eventChange",
            label: [
              "أثناء فعالية، تغيّر البرنامج فجأة أو اعتذر مشارك في اللحظة الأخيرة. ما التصرف الأنسب؟",
              "During an event, the schedule changes or a participant cancels at the last minute. What would you do?",
            ],
            rows: 4,
          },
        ],
      },
    ],
  },
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
            hint: "https://github.com/… أو https://linkedin.com/in/…",
            optional: true,
            label: [
              "رابط أعمالك (GitHub أو LinkedIn أو أي رابط لأعمالك)",
              "Portfolio link (GitHub, LinkedIn or any work link)",
            ],
            props: { type: "url", dir: "ltr" },
          },
        ],
      },
      { title: ["العمل الجماعي", "Teamwork"], questions: [leadership] },
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
      { title: ["العمل الجماعي", "Teamwork"], questions: [leadership] },
    ],
  },
];
