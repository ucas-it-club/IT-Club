import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, UserPlus, X } from "lucide-react";
import { BrandButton } from "@/components/club/BrandButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { normalizeAdminSearch } from "@/lib/club/admin-search";
import {
  committees,
  maxEventPeople,
  safeUrl,
  type Content,
  type EventPerson,
} from "@/lib/club/model";

/** A row in the editor. `searching` rows are still a search field, not a person. */
export type PersonRow = EventPerson & { key: number; searching?: boolean };

let nextKey = 0;
export const personRow = (person: EventPerson): PersonRow => ({ ...person, key: nextKey++ });
const searchRow = (role: EventPerson["role"]) => ({ ...personRow({ role }), searching: true });

/** The editor's rows for an event: its people, or one empty presenter search. */
export function initialPeopleRows(people: EventPerson[]): PersonRow[] {
  const rows = people.map(personRow);
  return rows.some((row) => row.role === "presenter") ? rows : [searchRow("presenter"), ...rows];
}

const committeeName = (key: string | undefined, en: boolean) =>
  key === "administrative"
    ? en
      ? "Administrative board"
      : "الهيئة الإدارية"
    : committees.find(([value]) => value === key)?.[en ? 2 : 1];

/** A member's details, copied into the event so later profile edits do not change it. */
function fromMember(member: Content, role: EventPerson["role"]): EventPerson {
  const bio = (en: boolean) =>
    [en ? member.role_en : member.role, committeeName(member.committee, en)]
      .filter(Boolean)
      .join(" · ") || undefined;

  return {
    role,
    memberId: member.id,
    name: member.title || undefined,
    name_en: member.title_en || undefined,
    ...(role === "presenter"
      ? {
          bio: bio(false),
          bio_en: bio(true),
          linkedinUrl: safeUrl(member.linkedinUrl),
          githubUrl: safeUrl(member.githubUrl),
        }
      : {}),
  };
}

/** The people to save, or the first problem with them. */
export function checkPeople(rows: PersonRow[], ar: boolean): EventPerson[] | string {
  const people = rows.filter((row) => !row.searching);
  const length = (value: string | undefined, min: number, max: number) => {
    const n = value?.trim().length ?? 0;
    return n === 0 || (n >= min && n <= max);
  };

  for (const role of ["presenter", "organizer"] as const) {
    if (people.filter((person) => person.role === role).length > maxEventPeople)
      return ar ? "الحد الأقصى 6 مقدمين و6 منظمين." : "At most 6 presenters and 6 organizers.";
  }

  for (const person of people) {
    const label = person.name?.trim() || person.name_en?.trim() || "";
    if (!label || !length(person.name, 2, 200) || !length(person.name_en, 2, 200))
      return ar
        ? "اكتب اسم كل شخص بلغة واحدة على الأقل (2 إلى 200 حرف)."
        : "Enter each person's name in at least one language (2 to 200 characters).";
    if (
      person.role === "presenter" &&
      (!(person.bio?.trim() || person.bio_en?.trim()) ||
        !length(person.bio, 2, 500) ||
        !length(person.bio_en, 2, 500))
    )
      return ar
        ? `اكتب نبذة عن ${label} بلغة واحدة على الأقل (2 إلى 500 حرف).`
        : `Enter a bio for ${label} in at least one language (2 to 500 characters).`;
    for (const url of [person.linkedinUrl, person.githubUrl])
      if (url?.trim() && !safeUrl(url.trim()))
        return ar ? "استخدم روابط HTTPS صحيحة." : "Use valid HTTPS links.";
  }

  return people.map(({ key: _key, searching: _searching, ...person }) => person);
}

function PersonSearch({
  role,
  members,
  taken,
  ar,
  onPick,
}: {
  role: EventPerson["role"];
  members: Content[];
  taken: string[];
  ar: boolean;
  onPick: (person: EventPerson) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = normalizeAdminSearch(query);
  const matches = normalized
    ? members
        .filter(
          (member) =>
            !taken.includes(member.id) &&
            [member.title, member.title_en].some((name) =>
              normalizeAdminSearch(name || "").includes(normalized),
            ),
        )
        .slice(0, 8)
    : [];
  const typed = query.trim();

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ps-9"
          aria-label={
            role === "presenter"
              ? ar
                ? "ابحث عن مقدم بالاسم"
                : "Search presenters by name"
              : ar
                ? "ابحث عن منظم بالاسم"
                : "Search organizers by name"
          }
          placeholder={ar ? "اكتب جزءًا من الاسم" : "Type part of a name"}
        />
      </div>
      {typed && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {matches.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-start hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => onPick(fromMember(member, role))}
              >
                <span className="font-bold">{ar ? member.title : member.title_en}</span>
                <span className="text-xs text-muted-foreground">
                  {ar ? member.title_en : member.title}
                </span>
              </button>
            </li>
          ))}
          {role === "presenter" && typed.length >= 2 && (
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-start font-bold text-primary hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() =>
                  onPick(/[؀-ۿ]/.test(typed) ? { role, name: typed } : { role, name_en: typed })
                }
              >
                <UserPlus className="size-4 shrink-0" aria-hidden="true" />
                {ar ? `أضف «${typed}» كشخص من خارج النادي` : `Add «${typed}» as outside person`}
              </button>
            </li>
          )}
          {role === "organizer" && matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {ar ? "لا يوجد عضو بهذا الاسم." : "No member matches."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function RowTools({
  index,
  count,
  ar,
  name,
  move,
  remove,
}: {
  index: number;
  count: number;
  ar: boolean;
  name: string;
  move: (by: number) => void;
  remove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <BrandButton
        type="button"
        variant="ghost"
        size="sm"
        disabled={index === 0}
        onClick={() => move(-1)}
        aria-label={ar ? `قدّم ${name}` : `Move ${name} up`}
      >
        <ArrowUp size={16} />
      </BrandButton>
      <BrandButton
        type="button"
        variant="ghost"
        size="sm"
        disabled={index === count - 1}
        onClick={() => move(1)}
        aria-label={ar ? `أخّر ${name}` : `Move ${name} down`}
      >
        <ArrowDown size={16} />
      </BrandButton>
      <BrandButton
        type="button"
        variant="ghost"
        size="sm"
        onClick={remove}
        aria-label={ar ? `احذف ${name}` : `Remove ${name}`}
      >
        <X size={16} />
      </BrandButton>
    </div>
  );
}

/** Ordered presenters and organizers of one event. */
export function EventPeopleEditor({
  rows,
  onChange,
  members,
  ar,
}: {
  rows: PersonRow[];
  onChange: (rows: PersonRow[]) => void;
  members: Content[];
  ar: boolean;
}) {
  const presenters = rows.filter((row) => row.role === "presenter");
  const organizers = rows.filter((row) => row.role === "organizer");
  // There is always at least one presenter row, so the search field never disappears.
  const set = (role: EventPerson["role"], list: PersonRow[]) =>
    onChange(
      role === "presenter"
        ? [...(list.length ? list : [searchRow("presenter")]), ...organizers]
        : [...presenters, ...list],
    );
  const update = (role: EventPerson["role"], list: PersonRow[], key: number, patch: object) =>
    set(
      role,
      list.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  const move = (role: EventPerson["role"], list: PersonRow[], index: number, by: number) => {
    const next = [...list];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row!);
    set(role, next);
  };
  const taken = (list: PersonRow[]) => list.flatMap((row) => (row.memberId ? [row.memberId] : []));
  const rowName = (row: PersonRow, index: number) =>
    (ar ? row.name || row.name_en : row.name_en || row.name) ||
    (ar ? `المقدم ${index + 1}` : `presenter ${index + 1}`);

  const field = (
    row: PersonRow,
    key: "name" | "name_en" | "bio" | "bio_en" | "linkedinUrl" | "githubUrl",
    label: string,
    plus?: React.ReactNode,
  ) => {
    const props = {
      value: row[key] ?? "",
      onChange: (e: { target: { value: string } }) =>
        update("presenter", presenters, row.key, { [key]: e.target.value || undefined }),
      dir: key === "name" || key === "bio" ? "rtl" : "ltr",
      maxLength: key.startsWith("bio") ? 500 : key.endsWith("Url") ? 500 : 200,
    } as const;

    return (
      <label className="block text-sm font-bold">
        <span className="mb-2 flex items-center justify-between gap-2">
          <span>{label}</span>
          {plus}
        </span>
        {key.startsWith("bio") ? (
          <Textarea rows={2} {...props} />
        ) : (
          <Input type={key.endsWith("Url") ? "url" : "text"} {...props} />
        )}
      </label>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-bold">{ar ? "مقدمو الفعالية" : "Presenters"}</h3>
        {presenters.map((row, index) => {
          const name = rowName(row, index);
          const plus = (
            <BrandButton
              type="button"
              variant="outline"
              size="sm"
              className="size-8 shrink-0 p-0"
              disabled={presenters.length >= maxEventPeople}
              onClick={() => {
                const next = [...presenters];
                next.splice(index + 1, 0, searchRow("presenter"));
                set("presenter", next);
              }}
              aria-label={ar ? "أضف مقدمًا آخر" : "Add another presenter"}
            >
              <Plus size={16} />
            </BrandButton>
          );
          const tools = (
            <RowTools
              index={index}
              count={presenters.length}
              ar={ar}
              name={name}
              move={(by) => move("presenter", presenters, index, by)}
              remove={() =>
                set(
                  "presenter",
                  presenters.filter((other) => other.key !== row.key),
                )
              }
            />
          );

          return (
            <div key={row.key} className="space-y-4 rounded-2xl border border-border p-4">
              {row.searching ? (
                <>
                  <div className="flex items-center justify-between gap-2 text-sm font-bold">
                    <span>{ar ? "ابحث عن مقدم الفعالية" : "Find the presenter"}</span>
                    <span className="flex items-center gap-1">
                      {presenters.length > 1 && tools}
                      {plus}
                    </span>
                  </div>
                  <PersonSearch
                    role="presenter"
                    members={members}
                    taken={taken(presenters)}
                    ar={ar}
                    onPick={(person) =>
                      update("presenter", presenters, row.key, {
                        ...person,
                        searching: false,
                      })
                    }
                  />
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      {row.memberId
                        ? ar
                          ? "عضو في النادي — التعديل هنا لهذه الفعالية فقط"
                          : "Club member — edits here apply to this event only"
                        : ar
                          ? "من خارج النادي"
                          : "Outside person"}
                    </span>
                    {tools}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field(
                      row,
                      "name",
                      ar ? "اسم مقدم الفعالية بالعربية" : "Presenter name in Arabic",
                      plus,
                    )}
                    {field(
                      row,
                      "name_en",
                      ar ? "اسم مقدم الفعالية بالإنجليزية" : "Presenter name in English",
                    )}
                    {field(row, "bio", ar ? "سطر عن المقدم بالعربية" : "Presenter bio in Arabic")}
                    {field(
                      row,
                      "bio_en",
                      ar ? "سطر عن المقدم بالإنجليزية" : "Presenter bio in English",
                    )}
                    {field(
                      row,
                      "linkedinUrl",
                      ar ? "رابط LinkedIn (اختياري)" : "LinkedIn (optional)",
                    )}
                    {field(row, "githubUrl", ar ? "رابط GitHub (اختياري)" : "GitHub (optional)")}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          {ar
            ? "يكفي الاسم والنبذة بلغة واحدة؛ تظهر للزوار باللغة الأخرى إن لم تُكتب."
            : "Name and bio in one language are enough; visitors see that language when the other is empty."}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-bold">{ar ? "منظمو الفعالية" : "Organizers"}</h3>
        {organizers.length > 0 && (
          <ul className="space-y-2">
            {organizers.map((row, index) => {
              const name = (ar ? row.name || row.name_en : row.name_en || row.name) || "";
              return (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-1"
                >
                  <span className="min-w-0 truncate font-bold">{name}</span>
                  <RowTools
                    index={index}
                    count={organizers.length}
                    ar={ar}
                    name={name}
                    move={(by) => move("organizer", organizers, index, by)}
                    remove={() =>
                      set(
                        "organizer",
                        organizers.filter((other) => other.key !== row.key),
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        {organizers.length < maxEventPeople && (
          <PersonSearch
            key={organizers.length}
            role="organizer"
            members={members}
            taken={taken(organizers)}
            ar={ar}
            onPick={(person) => set("organizer", [...organizers, personRow(person)])}
          />
        )}
      </div>
    </div>
  );
}
