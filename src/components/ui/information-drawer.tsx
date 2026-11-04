import { Link } from "@tanstack/react-router";
import { LockKeyhole, Plus } from "lucide-react";
import { committees, safeUrl, type Content, type Lang } from "@/lib/club/model";
import { hrefOf } from "@/lib/club/paths";
import logo from "@/assets/ucas-logo.webp";
import { plainRichText } from "@/lib/club/rich-text";

/** Team cards linking to each member's full profile page. */
export default function InformationDrawer({ teams, lang }: { teams: Content[]; lang: Lang }) {
  const ar = lang === "ar";
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
      {teams.map((member) => {
        const name = ar ? member.title : member.title_en || member.title;
        const description = ar ? member.description : member.description_en || member.description;
        const role = ar ? member.role : member.role_en || member.role;
        const photo = member.images?.map(safeUrl).find(Boolean);
        const image = photo || logo;
        const committee = committees.find(([key]) => key === member.committee);
        const committeeName = committee ? (ar ? committee[1] : committee[2]) : "";
        const profileEnabled = member.profileEnabled !== false;
        const card = (
          <>
            <span className="relative block aspect-[4/4.3] w-full overflow-hidden bg-brand-gradient-soft">
              <img
                src={image}
                alt=""
                width={450}
                height={600}
                loading="lazy"
                className={`h-full w-full transition duration-500 group-hover:scale-105 motion-reduce:transition-none ${photo ? "object-cover object-top" : "object-contain p-8"}`}
              />
              <span className="absolute end-2 top-2 rounded-full border border-white/40 bg-background/90 p-2 text-primary shadow-sm sm:end-3 sm:top-3">
                {profileEnabled ? <Plus size={17} /> : <LockKeyhole size={17} />}
              </span>
            </span>
            <span className="flex min-h-24 flex-1 flex-col justify-center p-3 sm:min-h-28 sm:p-4">
              <span className="truncate text-sm font-black leading-snug sm:text-base">{name}</span>
              <span className="mt-1.5 line-clamp-1 text-xs font-medium text-muted-foreground sm:text-sm">
                {role || plainRichText(description)}
              </span>
              {committeeName && (
                <span className="mt-3 w-fit max-w-full truncate rounded-full bg-brand-gradient-soft px-2.5 py-1 text-[10px] font-bold text-primary sm:text-xs">
                  {committeeName}
                </span>
              )}
              {!profileEnabled && (
                <span className="mt-2 text-xs font-semibold text-muted-foreground">
                  {ar ? "الصفحة غير متاحة" : "Profile unavailable"}
                </span>
              )}
            </span>
          </>
        );

        return profileEnabled ? (
          <Link
            key={member.id}
            to={hrefOf(lang, `members/${member.slug || member.id}`)}
            aria-label={ar ? `عرض معلومات ${name}` : `View ${name}`}
            className="group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-start shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:rounded-3xl"
          >
            {card}
          </Link>
        ) : (
          <div
            key={member.id}
            role="group"
            aria-label={ar ? `صفحة ${name} غير متاحة` : `${name}’s profile is unavailable`}
            aria-disabled="true"
            className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-start shadow-card sm:rounded-3xl"
          >
            {card}
          </div>
        );
      })}
    </div>
  );
}
