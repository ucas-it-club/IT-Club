import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, Moon, Sun, X } from "lucide-react";
import logo from "@/assets/ucas-logo.webp";
import { collections, isUnavailableSection, type ContentCollection } from "@/lib/club/model";
import { otherLangHref, pageOf } from "@/lib/club/paths";
import { readTheme, THEME_COOKIE, writePrefCookie } from "@/lib/club/prefs";
import { ClubProvider } from "./ClubProvider";
import { useClub } from "./club-context";
import { ClubLink, Heading } from "./ClubContent";
import { FloatingJoin } from "./FloatingJoin";
import { IconSwap } from "./IconSwap";
import { PrivacyNotice } from "./PrivacyNotice";
import { SiteFooter } from "./SiteFooter";
import { SiteBackground } from "./SiteBackground";
import { SiteStatus } from "./SiteStatus";

const AdminPanel = lazy(() =>
  import("./AdminPanel").then((module) => ({ default: module.AdminPanel })),
);
const JoinForm = lazy(() =>
  import("./PublicForm").then((module) => ({ default: module.PublicForm })),
);
const HomePage = lazy(() => import("./ClubPages").then((module) => ({ default: module.HomePage })));
const AboutPage = lazy(() =>
  import("./ClubPages").then((module) => ({ default: module.AboutPage })),
);
const ListingPage = lazy(() =>
  import("./ClubPages").then((module) => ({ default: module.ListingPage })),
);
const DetailPage = lazy(() =>
  import("./ClubPages").then((module) => ({ default: module.DetailPage })),
);
const ContactPage = lazy(() =>
  import("./ContactPage").then((module) => ({ default: module.ContactPage })),
);
const PrivacyPage = lazy(() =>
  import("./PrivacyPage").then((module) => ({ default: module.PrivacyPage })),
);

const navigationItems = [
  ["", "الرئيسية", "Home"],
  ["about", "من نحن", "About"],
  ["members", "الفريق", "Team"],
  ["partners", "الشراكات", "Partners"],
  ["events", "الفعاليات", "Events"],
  ["news", "الأخبار", "News"],
  ["contact", "تواصل معنا", "Contact"],
] as const;

function useTheme() {
  const [dark, setDark] = useState(() => readTheme() === "dark");
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    setDark(next);
    writePrefCookie(THEME_COOKIE, next ? "dark" : "light");
    try {
      localStorage.setItem("ucas-theme", next ? "dark" : "light");
    } catch {
      /* Optional storage. */
    }
  };
  return { dark, toggle };
}

function SiteHeader({ status }: { status: boolean }) {
  const location = useLocation();
  const { lang, loading, error, data, settings } = useClub();
  const [open, setOpen] = useState(false);
  // The mobile panel stays mounted for as long as its exit takes, so it can
  // shrink away instead of vanishing between two frames.
  const [panelOpen, setPanelOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const ar = lang === "ar";
  useEffect(() => {
    if (open) {
      setPanelOpen(true);
      return;
    }
    const timer = setTimeout(() => setPanelOpen(false), 320);
    return () => clearTimeout(timer);
  }, [open]);
  const links =
    loading || error
      ? navigationItems
      : navigationItems.filter(([path]) => !isUnavailableSection(path, data, settings));
  return (
    <header className="club-header sticky top-3 z-40 mx-auto max-w-7xl px-3 sm:px-4">
      <div className="club-header-surface">
        <div className="club-header-row flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <ClubLink className="club-header-brand flex shrink-0 items-center gap-2">
            <img
              src={logo}
              width={44}
              height={56}
              className="h-9 w-8 object-contain"
              alt="UCAS IT CLUB"
            />
            <span className="club-brand-text text-sm font-black">UCAS IT CLUB</span>
          </ClubLink>
          <nav
            aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}
            className="club-nav-bar hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex"
          >
            {links.map(([path, arabic, english]) => (
              <ClubLink
                key={path}
                path={path}
                navigation
                className="club-nav-link rounded-full px-3 py-2 text-sm font-bold"
              >
                {ar ? arabic : english}
              </ClubLink>
            ))}
          </nav>
          <div className="club-header-actions flex shrink-0 items-center gap-1">
            <Link
              to={otherLangHref(location.pathname)}
              hrefLang={ar ? "en" : "ar"}
              className="club-icon-button club-language-button"
              aria-label={ar ? "Switch to English" : "التبديل للعربية"}
            >
              <span lang={ar ? "en" : "ar"}>{ar ? "EN" : "عربي"}</span>
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="club-icon-button"
              aria-label={
                ar
                  ? dark
                    ? "تفعيل الوضع الفاتح"
                    : "تفعيل الوضع الداكن"
                  : dark
                    ? "Use light theme"
                    : "Use dark theme"
              }
              aria-pressed={dark}
              title={
                ar ? (dark ? "الوضع الفاتح" : "الوضع الداكن") : dark ? "Light theme" : "Dark theme"
              }
            >
              <IconSwap
                on={dark ? <Sun size={18} /> : null}
                off={dark ? null : <Moon size={18} />}
              />
            </button>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label={ar ? "القائمة" : "Menu"}
              className="rounded-xl p-2 xl:hidden"
            >
              <IconSwap on={open ? <X /> : null} off={open ? null : <Menu />} />
            </button>
          </div>
        </div>
        {panelOpen && (
          <nav
            className="club-mobile-nav xl:hidden"
            data-state={open ? "open" : "closed"}
            aria-hidden={!open}
          >
            {links.map(([path, arabic, english]) => (
              <span key={path} onClick={() => setOpen(false)}>
                <ClubLink
                  path={path}
                  navigation
                  className="club-nav-link block rounded-xl p-3 text-sm font-bold"
                >
                  {ar ? arabic : english}
                </ClubLink>
              </span>
            ))}
          </nav>
        )}
      </div>
      {/* Sticks with the navbar, hanging from its bottom edge. */}
      {status && <SiteStatus />}
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { lang, loading } = useClub();
  const page = pageOf(useLocation().pathname);
  const isAdmin = page.split("/")[0] === "admin";
  useEffect(() => {
    if (!loading && !window.__bootWaitHero) window.__bootDone?.();
  }, [loading]);
  // Prototype: ?motion=1 turns the premium motion layer on for this session (motion-proto.css),
  // ?motion=0 turns it off. It also lets the header step aside while reading down.
  useEffect(() => {
    const html = document.documentElement;
    const param = new URLSearchParams(window.location.search).get("motion");
    let on = false;
    try {
      if (param === "1") sessionStorage.setItem("ucas-motion", "1");
      if (param === "0") sessionStorage.removeItem("ucas-motion");
      on = sessionStorage.getItem("ucas-motion") === "1";
    } catch {
      // Storage blocked: the prototype simply stays off.
    }
    html.classList.toggle("motion", on);
    if (!on) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      html.toggleAttribute("data-scrolled", y > 40);
      // Ignore jitter; hide only while reading down, never with focus inside the header.
      if (Math.abs(y - last) < 6) return;
      const inHeader = document.querySelector(".club-header")?.contains(document.activeElement);
      html.toggleAttribute("data-header-away", y > last && y > 240 && !inHeader);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="club-site relative isolate min-h-screen">
      {!isAdmin && <SiteBackground />}
      <a href="#club-main" className="sr-only focus:not-sr-only">
        {lang === "ar" ? "انتقل للمحتوى" : "Skip to content"}
      </a>
      <SiteHeader status={!isAdmin} />
      <main
        id="club-main"
        tabIndex={-1}
        className={`mx-auto max-w-6xl px-4 animate-stage-in ${page === "" ? "pt-4 pb-12 sm:pt-5 sm:pb-16" : "py-12 sm:py-16"}`}
      >
        {children}
      </main>
      {!isAdmin && !page.startsWith("join") && <FloatingJoin ar={lang === "ar"} />}
      <PrivacyNotice ar={lang === "ar"} />
      {!isAdmin && !loading && <SiteFooter />}
    </div>
  );
}

export function Missing() {
  const { lang } = useClub();
  return (
    <>
      <Heading ar="الصفحة غير موجودة" en="Page not found" />
      <div className="text-center">
        <ClubLink>{lang === "ar" ? "العودة للرئيسية" : "Back to home"}</ClubLink>
      </div>
    </>
  );
}

function LoadingView({ admin = false }: { admin?: boolean }) {
  const { lang } = useClub();
  return (
    <div role="status" className="flex min-h-[45vh] items-center justify-center">
      {!admin && (
        <img src={logo} alt="UCAS IT CLUB" className="h-64 w-64 object-contain sm:h-80 sm:w-80" />
      )}
      <span className="sr-only">
        {lang === "ar"
          ? admin
            ? "تحميل الإدارة"
            : "تحميل الموقع"
          : admin
            ? "Loading admin"
            : "Loading website"}
      </span>
    </div>
  );
}

/** The page for the current path; routes render this inside ClubSite. */
export function ContentPage() {
  const { loading, error, lang } = useClub();
  const [page, id] = pageOf(useLocation().pathname).split("/");
  if (page === "admin")
    return (
      <Suspense fallback={<LoadingView admin />}>
        <AdminPanel />
      </Suspense>
    );
  if (page === "join")
    return (
      <Suspense
        fallback={
          <div role="status" className="flex min-h-[45vh] items-center justify-center">
            <span>{lang === "ar" ? "جارٍ تجهيز نموذج الانضمام…" : "Preparing the join form…"}</span>
          </div>
        }
      >
        <JoinForm join />
      </Suspense>
    );
  if (page === "contact")
    return (
      <Suspense fallback={<LoadingView />}>
        <ContactPage />
      </Suspense>
    );
  if (page === "privacy")
    return (
      <Suspense fallback={<LoadingView />}>
        <PrivacyPage />
      </Suspense>
    );
  if (loading) return <LoadingView />;
  if (error)
    return (
      <p role="alert" className="py-20 text-center">
        {lang === "ar"
          ? "تعذر تحميل المحتوى. يرجى تحديث الصفحة والمحاولة مجددًا."
          : "Content could not be loaded. Please refresh and try again."}
      </p>
    );
  if (!page)
    return (
      <Suspense fallback={<LoadingView />}>
        <HomePage />
      </Suspense>
    );
  if (page === "about")
    return (
      <Suspense fallback={<LoadingView />}>
        <AboutPage />
      </Suspense>
    );
  if (collections.includes(page as ContentCollection))
    return (
      <Suspense fallback={<LoadingView />}>
        {id ? (
          <DetailPage kind={page as ContentCollection} id={id} />
        ) : (
          <ListingPage key={page} kind={page as ContentCollection} />
        )}
      </Suspense>
    );
  return <Missing />;
}

/** The persistent site chrome shared by every public and administrative route. */
export function ClubSite({ children }: { children: ReactNode }) {
  return (
    <ClubProvider>
      <Shell>{children}</Shell>
    </ClubProvider>
  );
}
