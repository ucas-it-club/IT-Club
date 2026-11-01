import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import cairoArabic from "../assets/fonts/cairo-arabic.woff2?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { readTheme } from "../lib/club/prefs";
import { langOf } from "../lib/club/paths";
import {
  ldJson,
  organizationLd,
  pages,
  seo,
  siteName,
  verificationMeta,
  type Contact,
} from "../lib/club/seo";
import { safeUrl } from "../lib/club/model";
import { loadClubData } from "../lib/club/ssr-data";
import { ClubSite, Missing } from "@/components/club/ClubSite";
import { BootScreen } from "@/components/club/BootScreen";

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Every page, 404s included, renders inside ClubSite, whose footer waits for
  // this data. Only the few contact facts the head needs are returned; the
  // payload itself already ships once, in the query cache.
  loader: async ({ context }): Promise<{ contact: Contact }> => {
    const settings = (await loadClubData(context.queryClient))?.settings;
    const profiles = [settings?.linkedin, settings?.instagram, settings?.facebook, settings?.github]
      .map(safeUrl)
      .filter((url): url is string => Boolean(url));

    return { contact: { email: settings?.email?.trim() || undefined, profiles } };
  },
  // After the loader: the router infers head's loaderData from it, in object order.
  head: ({ matches, loaderData }) => {
    const lang = langOf(matches.at(-1)?.pathname ?? "/");
    const missing = matches.some((routeMatch) => routeMatch.status === "notFound");
    // TanStack 1.170 currently loses root-loader data in this callback's
    // generic type, although the runtime value is the loader result above.
    const rootData = loaderData as unknown as { contact: Contact } | undefined;
    // Only unmatched URLs end here; every page route sets its own tags on top.
    const page = missing ? "missing" : "home";

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "author", content: siteName[lang] },
        ...verificationMeta(),
        ...seo({
          lang,
          title: pages[page][lang].title,
          description: pages[page][lang].description,
          path: "/",
          noindex: missing,
        }),
        ldJson(organizationLd(lang, rootData?.contact ?? { profiles: [] })),
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        // Cairo, self-hosted: the same face the club already uses, without a
        // render-blocking stylesheet on a third-party origin. Both cuts are
        // variable, so one file per script covers every weight.
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: cairoArabic,
          crossOrigin: "anonymous",
        },
        { rel: "icon", href: "/favicon.png", type: "image/png" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: Missing,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // The address is the language, on the server and in the browser alike.
  const lang = langOf(useLocation().pathname);
  const theme = readTheme();

  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={theme === "dark" ? "dark" : undefined}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        {/* Covers visitors whose preference predates the cookie: apply their
            stored theme before first paint and seed the cookie so the next
            document is server-rendered with it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){document.documentElement.classList.add('js');try{var theme=localStorage.getItem('ucas-theme');if(!theme)return;var dark=theme==='dark';document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';document.cookie='ucas-theme='+(dark?'dark':'light')+'; path=/; max-age=31536000; samesite=lax';}catch(e){}})();`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        <BootScreen />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* One site chrome for every route; only the page inside it changes. */}
      <ClubSite>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </ClubSite>
    </QueryClientProvider>
  );
}
