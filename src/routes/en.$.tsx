import { createFileRoute } from "@tanstack/react-router";
import { ContentPage, Missing } from "@/components/club/ClubSite";
import { loadPage, pageHead } from "@/lib/club/page-route";

// Every English page: /en/about, /en/team, /en/news/<slug> …
export const Route = createFileRoute("/en/$")({
  // Before head: the router infers head's loaderData from it, in object order.
  loader: ({ context, params }) => loadPage(context.queryClient, "en", params._splat ?? ""),
  head: ({ params, match, loaderData }) =>
    pageHead("en", params._splat ?? "", match.status === "notFound", loaderData),
  component: ContentPage,
  notFoundComponent: Missing,
});
