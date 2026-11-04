import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/club/ClubSite";
import { homeHead } from "@/lib/club/page-route";

export const Route = createFileRoute("/en/")({
  head: () => homeHead("en"),
  component: ContentPage,
});
