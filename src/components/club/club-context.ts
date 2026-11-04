import { createContext, useContext } from "react";
import { emptySettings, type Content, type ContentCollection, type Lang } from "@/lib/club/model";
import { clubPublicKey } from "@/lib/club/query-keys";

export const emptyClubData: Record<ContentCollection, Content[]> = {
  members: [],
  events: [],
  news: [],
  partners: [],
};

export { clubPublicKey };

export const ClubContext = createContext({
  lang: "ar" as Lang,
  data: emptyClubData,
  settings: emptySettings,
  visitorCount: null as number | null,
  loading: false,
  error: false,
  setupRequired: false,
});

export const useClub = () => useContext(ClubContext);
