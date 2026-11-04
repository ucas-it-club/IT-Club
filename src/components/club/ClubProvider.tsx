import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { emptySettings, type Settings } from "@/lib/club/model";
import { configured, loadPublic, SetupRequiredError } from "@/lib/club/public-api";
import { recordVisit } from "@/lib/club/visits";
import { useLocation } from "@tanstack/react-router";
import { langOf } from "@/lib/club/paths";

import { ClubContext, clubPublicKey, emptyClubData } from "./club-context";

export function ClubProvider({ children }: { children: ReactNode }) {
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    // Visit accounting is useful, but it must not compete with hydration,
    // fonts and above-the-fold assets on a slow phone connection.
    const timer = window.setTimeout(() => {
      void recordVisit()
        .then((count) => {
          if (active) setVisitorCount(count);
        })
        .catch(() => {});
    }, 1500);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);
  // The URL is the language: /en/... is English, everything else Arabic. No
  // cookie or stored preference, so every address shows one language to
  // everyone, search engines included.
  const lang = langOf(useLocation().pathname);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const queryClient = useQueryClient();
  useEffect(() => {
    const onChanged = () => void queryClient.invalidateQueries({ queryKey: clubPublicKey });
    window.addEventListener("club-data-changed", onChanged);

    return () => window.removeEventListener("club-data-changed", onChanged);
  }, [queryClient]);

  const query = useQuery({
    queryKey: clubPublicKey,
    queryFn: ({ signal }) => loadPublic(fetch, signal),
    enabled: configured,
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const data = query.data?.data ?? emptyClubData;

  const settings = useMemo<Settings>(
    () => ({ ...emptySettings, ...query.data?.settings }),
    [query.data?.settings],
  );

  const loading = configured && query.isLoading;
  const setupRequired = query.error instanceof SetupRequiredError;
  const error = Boolean(query.error) && !setupRequired;

  useEffect(
    () => () => {
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
    },
    [],
  );

  const value = useMemo(
    () => ({ lang, data, settings, loading, error, setupRequired, visitorCount }),
    [lang, data, settings, loading, error, setupRequired, visitorCount],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}
