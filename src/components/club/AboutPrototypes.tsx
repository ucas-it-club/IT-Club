import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { useSearch } from "@tanstack/react-router";
import { categories, collegeUrl, committees, local } from "@/lib/club/model";
import { contentImageUrls } from "@/lib/club/google-drive";
import { plainRichText, splitRichText } from "@/lib/club/rich-text";
import { ClubLink } from "./ClubContent";
import { RichText } from "./RichText";
import { useClub } from "./club-context";
import "./about-page.css";

/**
 * About page, three prototypes of the same editor-authored content, none of them a
 * wall of text: one thing on screen at a time, or closed until you open it.
 * Pick one with ?about=stage | words | photo | roll | sheets | index (stage is the default).
 *
 *   stage  a scroll story like the home hero: one statement, one goal at a time.
 *   words  five huge words; open one to read it, one open at a time.
 *   photo  the club's own photographs full screen, a statement over each.
 */

type Variant = "stage" | "words" | "photo" | "roll" | "sheets" | "index";

function useAbout() {
  const { lang, settings, data } = useClub();
  const ar = lang === "ar";
  const n = (v: number) => v.toLocaleString(ar ? "ar-EG" : "en-US");
  const statement = (key: "vision" | "mission") => {
    const configured = settings[ar ? key : (`${key}_en` as "vision_en" | "mission_en")] || "";

    return plainRichText(configured).trim()
      ? configured
      : ar
        ? "سيُنشر النص الرسمي المعتمد قريبًا."
        : "The approved official statement will be published here.";
  };
  const byOrder = (a: { displayOrder?: number }, b: { displayOrder?: number }) =>
    (a.displayOrder ?? 10000) - (b.displayOrder ?? 10000);
  const people = [
    {
      key: "administrative",
      label: ar ? "الهيئة الإدارية" : "Administrative board",
      members: data.members
        .filter((m) => m.isFounder || m.committee === "administrative")
        .sort(byOrder),
    },
    ...committees.map(([key, arabic, english]) => ({
      key,
      label: ar ? arabic : english,
      members: data.members.filter((m) => m.committee === key && !m.isFounder).sort(byOrder),
    })),
  ].filter((g) => g.members.length > 0);
  const groups = people.map((g) => ({
    key: g.key,
    label: g.label,
    count: g.members.length,
    names: g.members.map((m) => local(m, "title", lang)),
  }));
  // The club's own photographs, newest first: real material for the photo prototype.
  const photos = [...data.events, ...data.news]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .flatMap((item) => contentImageUrls(item).slice(0, 1))
    .slice(0, 8);

  return {
    ar,
    lang,
    n,
    groups,
    photos,
    teamVisible: settings.teamVisible !== false,
    goals: splitRichText(settings[ar ? "goals" : "goals_en"] || ""),
    vision: statement("vision"),
    mission: statement("mission"),
    labels: {
      vision: ar ? "رؤيتنا" : "Our vision",
      mission: ar ? "رسالتنا" : "Our mission",
      goals: ar ? "أهدافنا" : "Our goals",
      team: ar ? "كيف يعمل النادي" : "How the club works",
      fields: ar ? "مجالات عملنا" : "Our fields",
    },
    members: (count: number) =>
      ar
        ? `${n(count)} ${count === 1 ? "عضو" : "أعضاء"}`
        : `${n(count)} ${count === 1 ? "member" : "members"}`,
  };
}

function College() {
  const { ar, lang } = useAbout();

  return (
    <>
      {ar ? "نادٍ طلابي في " : "A student-run club at the "}
      <a href={collegeUrl[lang]} target="_blank" rel="noopener">
        {ar ? "الكلية الجامعية للعلوم التطبيقية" : "University College of Applied Sciences"}
      </a>
      {ar
        ? "، يديره طلبته ويجمع المهتمين بالبرمجة والتصميم والألعاب والوسائط."
        : " for everyone working in code, design, games and media."}
    </>
  );
}

function Goal({ text }: { text: string }) {
  // Goals are stored with a leading bullet; the numeral stands in for it.
  return <RichText value={text.replace(/^\s*[•·*–-]\s*/, "")} className="ab-plain" />;
}

function TeamLink() {
  const { ar, teamVisible } = useAbout();
  const Arrow = ar ? ArrowLeft : ArrowRight;

  if (!teamVisible) return null;

  return (
    <ClubLink path="members" className="ab-link">
      {ar ? "تعرّف على الفريق" : "Meet the team"}
      <Arrow size={20} aria-hidden="true" />
    </ClubLink>
  );
}

function Groups() {
  const a = useAbout();

  return (
    <>
      <ul className="ab-rows">
        {a.groups.map((g) => (
          <li key={g.key}>
            <span>{g.label}</span>
            <span>{a.members(g.count)}</span>
          </li>
        ))}
      </ul>
      <TeamLink />
    </>
  );
}

function Fields() {
  const { ar } = useAbout();

  return (
    <ul className="ab-words">
      {categories.map(([key, arabic, english]) => (
        <li key={key}>{ar ? arabic : english}</li>
      ))}
    </ul>
  );
}

/** A: a scroll story. The stage holds still; the scroll picks what it says. */
function Stage() {
  const a = useAbout();
  const { ar, n, goals } = a;
  const track = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(0);

  type Step =
    | { kind: "intro" }
    | { kind: "vision" | "mission" }
    | { kind: "goal"; index: number; text: string }
    | { kind: "team" | "fields" };
  const steps: Step[] = [
    { kind: "intro" },
    { kind: "vision" },
    { kind: "mission" },
    ...goals.map((text, index): Step => ({ kind: "goal", index, text })),
    { kind: "team" },
    { kind: "fields" },
  ];
  const count = steps.length;

  useEffect(() => {
    const node = track.current;

    if (!node) return;
    let frame = 0;
    // Straight from the scroll position, no timer: whatever the scroll says is what shows.
    const apply = () => {
      frame = 0;
      const top = node.getBoundingClientRect().top + window.scrollY;
      const span = Math.max(1, node.offsetHeight - window.innerHeight);
      const p = Math.min(0.9999, Math.max(0, (window.scrollY - (top - 80)) / span));

      setOn(Math.floor(p * count));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  return (
    <div className="ab ab-stage" style={{ "--ab-steps": count } as CSSProperties}>
      <div className="ab-track" ref={track}>
        <div className="ab-stage-in">
          {steps.map((step, i) => (
            <section
              key={i}
              className="ab-step"
              data-kind={step.kind}
              data-on={i === on ? "" : undefined}
              data-past={i < on ? "" : undefined}
            >
              {step.kind === "intro" && (
                <>
                  <h1>{ar ? "من نحن" : "About the club"}</h1>
                  <p className="ab-sub">
                    <College />
                  </p>
                </>
              )}
              {(step.kind === "vision" || step.kind === "mission") && (
                <>
                  <h2>{a.labels[step.kind]}</h2>
                  <RichText value={a[step.kind]} className="ab-big ab-plain" />
                </>
              )}
              {step.kind === "goal" && (
                <>
                  <h2>
                    {a.labels.goals}
                    <span>
                      {n(step.index + 1)} / {n(goals.length)}
                    </span>
                  </h2>
                  <div className="ab-big">
                    <Goal text={step.text} />
                  </div>
                </>
              )}
              {step.kind === "team" && (
                <>
                  <h2>{a.labels.team}</h2>
                  <Groups />
                </>
              )}
              {step.kind === "fields" && (
                <>
                  <h2>{a.labels.fields}</h2>
                  <Fields />
                </>
              )}
            </section>
          ))}
          <div className="ab-dots" aria-hidden="true">
            {steps.map((_, i) => (
              <i key={i} data-on={i === on ? "" : undefined} data-past={i < on ? "" : undefined} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** B: five huge words; one opens at a time. */
function Words() {
  const a = useAbout();
  const { ar, n, goals } = a;
  const [open, setOpen] = useState<string | null>(null);
  const rows: { key: string; label: string; meta: string; body: ReactNode }[] = [
    {
      key: "vision",
      label: a.labels.vision,
      meta: "",
      body: <RichText value={a.vision} className="ab-big ab-plain" />,
    },
    {
      key: "mission",
      label: a.labels.mission,
      meta: "",
      body: <RichText value={a.mission} className="ab-big ab-plain" />,
    },
    {
      key: "goals",
      label: a.labels.goals,
      meta: n(goals.length),
      body:
        goals.length > 0 ? (
          <ol className="ab-goals">
            {goals.map((goal, i) => (
              <li key={i}>
                <span aria-hidden="true">{n(i + 1)}</span>
                <Goal text={goal} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="ab-sub">
            {ar ? "ستُنشر أهداف النادي قريبًا." : "Goals will be published here."}
          </p>
        ),
    },
    { key: "team", label: a.labels.team, meta: n(a.groups.length), body: <Groups /> },
    { key: "fields", label: a.labels.fields, meta: n(categories.length), body: <Fields /> },
  ];

  return (
    <div className="ab ab-words-page">
      <header className="ab-head">
        <h1>{ar ? "من نحن" : "About the club"}</h1>
        <p>
          <College />
        </p>
      </header>
      <ul className="ab-acc">
        {rows.map((row) => {
          const isOpen = open === row.key;

          return (
            <li key={row.key} data-open={isOpen ? "" : undefined}>
              <h2>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`ab-p-${row.key}`}
                  onClick={() => setOpen(isOpen ? null : row.key)}
                >
                  <span className="ab-word">{row.label}</span>
                  {row.meta && <span className="ab-meta">{row.meta}</span>}
                  <ChevronDown size={32} aria-hidden="true" />
                </button>
              </h2>
              <div id={`ab-p-${row.key}`} className="ab-panel" role="region" aria-label={row.label}>
                <div>
                  <div className="ab-panel-in">{row.body}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** C: the club's own photographs, full screen, a statement over each. */
function Photo() {
  const a = useAbout();
  const { ar, n, goals, photos } = a;
  const shot = (i: number) => photos[i % Math.max(1, photos.length)];
  const frame = (key: string, i: number, label: string, children: ReactNode) => (
    <section key={key} className="ab-shot" aria-label={label}>
      {shot(i) && <img src={shot(i)} alt="" loading={i < 2 ? "eager" : "lazy"} decoding="async" />}
      <div className="ab-shot-in">{children}</div>
    </section>
  );

  return (
    <div className="ab ab-photo">
      {frame(
        "intro",
        0,
        ar ? "من نحن" : "About the club",
        <>
          <h1>{ar ? "من نحن" : "About the club"}</h1>
          <p className="ab-sub">
            <College />
          </p>
        </>,
      )}
      {frame(
        "vision",
        1,
        a.labels.vision,
        <>
          <h2>{a.labels.vision}</h2>
          <RichText value={a.vision} className="ab-big ab-plain" />
        </>,
      )}
      {frame(
        "mission",
        2,
        a.labels.mission,
        <>
          <h2>{a.labels.mission}</h2>
          <RichText value={a.mission} className="ab-big ab-plain" />
        </>,
      )}
      {frame(
        "goals",
        3,
        a.labels.goals,
        <>
          <h2>{a.labels.goals}</h2>
          {goals.length > 0 && (
            <ol className="ab-swipe">
              {goals.map((goal, i) => (
                <li key={i}>
                  <span aria-hidden="true">{n(i + 1)}</span>
                  <Goal text={goal} />
                </li>
              ))}
            </ol>
          )}
        </>,
      )}
      {frame(
        "team",
        4,
        a.labels.team,
        <>
          <h2>{a.labels.team}</h2>
          <Groups />
        </>,
      )}
      {frame(
        "fields",
        5,
        a.labels.fields,
        <>
          <h2>{a.labels.fields}</h2>
          <Fields />
        </>,
      )}
    </div>
  );
}


/* ---------- The first three prototypes: bands, sheets, index ---------- */

function Head() {
  const { ar } = useAbout();

  return (
    <header className="ab-head">
      <h1>{ar ? "من نحن" : "About the club"}</h1>
      <p>
        <College />
      </p>
    </header>
  );
}

function GoalsRuled({ id }: { id?: string }) {
  const { ar, n, goals, labels } = useAbout();

  return (
    <section className="ab-section" aria-labelledby={id}>
      <h2 id={id}>{labels.goals}</h2>
      {goals.length > 0 ? (
        <ol className="ab-goals">
          {goals.map((goal, i) => (
            <li key={i}>
              <span aria-hidden="true">{n(i + 1)}</span>
              <Goal text={goal} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="ab-empty">
          {ar ? "ستُنشر أهداف النادي قريبًا." : "The club's goals will be published here."}
        </p>
      )}
    </section>
  );
}

function FieldsRuled({ id }: { id?: string }) {
  const { ar, labels } = useAbout();

  return (
    <section className="ab-section" aria-labelledby={id}>
      <h2 id={id}>{labels.fields}</h2>
      <ul className="ab-fields">
        {categories.map(([key, arabic, english]) => (
          <li key={key}>{ar ? arabic : english}</li>
        ))}
      </ul>
    </section>
  );
}

/** Roll: the committees are the spine, one band each with the members' names run in. */
function Roll() {
  const a = useAbout();

  return (
    <div className="ab ab-roll">
      <Head />
      {(
        [
          ["vision", a.labels.vision, a.vision],
          ["mission", a.labels.mission, a.mission],
        ] as const
      ).map(([key, label, text]) => (
        <section key={key} className="ab-band" data-tone={key} aria-labelledby={`ab-${key}`}>
          <div className="ab-band-in">
            <h2 id={`ab-${key}`}>{label}</h2>
            <RichText value={text} className="ab-statement ab-plain" />
          </div>
        </section>
      ))}
      {a.groups.map((group, index) => (
        <section
          key={group.key}
          className="ab-band ab-group"
          data-tone={index % 2 ? "b" : "a"}
          data-bare={a.teamVisible ? undefined : ""}
          aria-labelledby={`ab-g-${group.key}`}
        >
          <div className="ab-band-in">
            <div className="ab-group-head">
              <h2 id={`ab-g-${group.key}`}>{group.label}</h2>
              <p className="ab-count">{a.members(group.count)}</p>
            </div>
            {a.teamVisible && (
              <ul className="ab-names">
                {group.names.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
      <div className="ab-ground">
        <GoalsRuled id="ab-goals" />
        <FieldsRuled id="ab-fields" />
        <TeamLink />
      </div>
    </div>
  );
}

/** Sheets: vision, mission and the team as sheets that slide over one another. */
function Sheets() {
  const a = useAbout();

  return (
    <div className="ab ab-sheets-page">
      <Head />
      <div className="ab-sheets">
        {(
          [
            ["vision", a.labels.vision, a.vision],
            ["mission", a.labels.mission, a.mission],
          ] as const
        ).map(([key, label, text]) => (
          <section key={key} className="ab-sheet" data-tone={key} aria-labelledby={`ab-${key}`}>
            <div className="ab-sheet-in">
              <h2 id={`ab-${key}`}>{label}</h2>
              <RichText value={text} className="ab-statement ab-plain" />
            </div>
          </section>
        ))}
        <section className="ab-sheet" data-tone="who" aria-labelledby="ab-who">
          <div className="ab-sheet-in">
            <h2 id="ab-who">{a.labels.team}</h2>
            <Groups />
          </div>
        </section>
      </div>
      <div className="ab-ground">
        <GoalsRuled id="ab-goals" />
        <FieldsRuled id="ab-fields" />
      </div>
    </div>
  );
}

/** Index: a sticky section index beside ruled rows, read like a document. */
function Index() {
  const a = useAbout();
  const root = useRef<HTMLDivElement>(null);
  const sections: [string, string][] = [
    ["ab-vision", a.labels.vision],
    ["ab-mission", a.labels.mission],
    ["ab-team", a.labels.team],
    ["ab-goals", a.labels.goals],
    ["ab-fields", a.labels.fields],
  ];

  useEffect(() => {
    const node = root.current;

    if (!node || !("IntersectionObserver" in window)) return;
    const links = [...node.querySelectorAll<HTMLElement>(".ab-rail a")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          links.forEach((link) =>
            link.toggleAttribute("data-on", link.getAttribute("href") === `#${entry.target.id}`),
          );
        }
      },
      // The band of the screen just under the header.
      { rootMargin: "-20% 0px -70% 0px" },
    );

    node.querySelectorAll("[data-spy]").forEach((el) => io.observe(el));
    links[0]?.toggleAttribute("data-on", true);

    return () => io.disconnect();
  }, []);

  return (
    <div className="ab ab-index" ref={root}>
      <Head />
      <div className="ab-index-grid">
        <nav className="ab-rail" aria-label={a.ar ? "أقسام الصفحة" : "On this page"}>
          {sections.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="ab-flow">
          {(
            [
              ["ab-vision", a.labels.vision, a.vision],
              ["ab-mission", a.labels.mission, a.mission],
            ] as const
          ).map(([id, label, text]) => (
            <section key={id} id={id} data-spy className="ab-section" aria-labelledby={`${id}-h`}>
              <h2 id={`${id}-h`}>{label}</h2>
              <RichText value={text} className="ab-statement ab-plain" />
            </section>
          ))}
          <section id="ab-team" data-spy className="ab-section" aria-labelledby="ab-team-h">
            <h2 id="ab-team-h">{a.labels.team}</h2>
            <ul className="ab-rows">
              {a.groups.map((g) => (
                <li key={g.key}>
                  <span>{g.label}</span>
                  <span>{a.members(g.count)}</span>
                  {a.teamVisible && <span className="ab-run">{g.names.join(" · ")}</span>}
                </li>
              ))}
            </ul>
          </section>
          <div id="ab-goals" data-spy>
            <GoalsRuled id="ab-goals-h" />
          </div>
          <div id="ab-fields" data-spy>
            <FieldsRuled id="ab-fields-h" />
          </div>
          <TeamLink />
        </div>
      </div>
    </div>
  );
}

/** Switches the prototypes; a plain link each, so the choice survives a reload. */
function Switcher({ current }: { current: Variant }) {
  const { ar } = useAbout();
  const items: [Variant, string][] = [
    ["stage", ar ? "أ · المسرح" : "A · Stage"],
    ["words", ar ? "ب · الكلمات" : "B · Words"],
    ["photo", ar ? "ج · الصور" : "C · Photo"],
    ["roll", ar ? "د · السجل" : "D · Roll"],
    ["sheets", ar ? "هـ · الصفحات" : "E · Sheets"],
    ["index", ar ? "و · الفهرس" : "F · Index"],
  ];

  return (
    <nav className="ab-switch" aria-label={ar ? "نماذج الصفحة" : "Page prototypes"} dir="ltr">
      {items.map(([key, label]) => (
        <a key={key} href={`?about=${key}`} aria-current={key === current ? "page" : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

export function AboutPrototypes() {
  const { about } = useSearch({ strict: false }) as { about?: unknown };
  const known: Variant[] = ["words", "photo", "roll", "sheets", "index"];
  const variant: Variant = known.includes(about as Variant) ? (about as Variant) : "stage";
  const page = {
    stage: <Stage />,
    words: <Words />,
    photo: <Photo />,
    roll: <Roll />,
    sheets: <Sheets />,
    index: <Index />,
  }[variant];

  return (
    <>
      {page}
      <Switcher current={variant} />
    </>
  );
}
