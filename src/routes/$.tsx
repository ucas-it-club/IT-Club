import { createFileRoute } from "@tanstack/react-router";
import { ContentPage, Missing } from "@/components/club/ClubSite";
import { loadPage, pageHead } from "@/lib/club/page-route";

// Every Arabic page: /about, /team, /news/<slug>, /admin …
export const Route = createFileRoute("/$")({
  // Before head: the router infers head's loaderData from it, in object order.
  loader: ({ context, params }) => loadPage(context.queryClient, "ar", params._splat ?? ""),
  head: ({ params, match, loaderData }) =>
    pageHead("ar", params._splat ?? "", match.status === "notFound", loaderData),
  component: ContentPage,
  notFoundComponent: Missing,
});
