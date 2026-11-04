import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";

/** The dehydrated queries as plain JSON, which is all that has to serialize. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type SerializedQueries = Json[];
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // /About is not /about: one address per page, anything else is a 404.
    caseSensitive: true,
    defaultPreloadStaleTime: 0,
    // Ship the server's query cache with the document so the client renders
    // the loader's data instead of refetching it after hydration.
    // Only queries cross the wire; mutations are client-only, and their keys
    // are typed too loosely to satisfy the router's serializability check.
    dehydrate: () => ({
      queries: dehydrate(queryClient, { shouldDehydrateMutation: () => false })
        .queries as unknown as SerializedQueries,
    }),
    hydrate: (dehydrated) =>
      hydrate(queryClient, {
        queries: dehydrated.queries as unknown as DehydratedState["queries"],
        mutations: [],
      }),
  });

  return router;
};
