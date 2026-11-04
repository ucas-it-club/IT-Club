import { createFileRoute, redirect } from "@tanstack/react-router";
import { findItem } from "@/lib/club/model";
import { isCollection } from "@/lib/club/page-route";
import { hrefOf, itemPage } from "@/lib/club/paths";
import { loadClubData } from "@/lib/club/ssr-data";

/**
 * Old /club/... links, permanently moved to their new address in one hop:
 * /club/members → /team, /club/news/<id> → /news/<slug>, /club/admin → /admin.
 * They go to the Arabic version, the site's default; the old URLs carried no
 * language of their own.
 */
export const Route = createFileRoute("/club/$")({
  loader: async ({ context, params }) => {
    const page = (params._splat ?? "").replace(/\/+$/, "");
    const [kind = "", ref] = page.split("/");
    const loaded = await loadClubData(context.queryClient);
    const hit = loaded && ref && isCollection(kind) ? findItem(loaded.data, kind, ref) : undefined;

    throw redirect({
      href: hrefOf("ar", hit ? itemPage(hit.kind, hit.item, loaded!.data) : page),
      statusCode: 301,
    });
  },
});
