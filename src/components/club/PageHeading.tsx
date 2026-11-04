import type { ReactNode } from "react";
import { useClub } from "./club-context";

export function PageHeading({
  ar,
  en,
  children,
}: {
  ar: string;
  en: string;
  children?: ReactNode;
}) {
  const { lang } = useClub();

  return (
    <div className="mb-10 text-center">
      <p className="text-sm font-bold text-primary">UCAS IT CLUB</p>
      <h1 className="mt-3 text-3xl font-black sm:text-5xl text-gradient-brand">
        {lang === "ar" ? ar : en}
      </h1>
      {children && (
        <div className="mx-auto mt-5 max-w-2xl text-base leading-loose text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}
