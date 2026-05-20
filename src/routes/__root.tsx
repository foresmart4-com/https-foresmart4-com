import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <p className="mt-4 text-muted-foreground">Page not found</p>
        <Link to="/" className="mt-6 inline-flex rounded-md gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "ForeSmart" },
      { name: "google-site-verification", content: "81pqRJlRgVXh9wi5nQ7YtUbkx45HkypGz_t2soHC9b8" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "ForeSmart" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c0d459e6-344b-4b70-948f-d9988d96d6cc/id-preview-f5d5f501--5a68377c-93dc-42f4-9999-fc0850af1ae2.lovable.app-1778416419613.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c0d459e6-344b-4b70-948f-d9988d96d6cc/id-preview-f5d5f501--5a68377c-93dc-42f4-9999-fc0850af1ae2.lovable.app-1778416419613.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;500;600&family=Playfair+Display:wght@500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "ForeSmart",
          url: "https://foresmart4.store",
          description: "AI-driven market intelligence across global stocks, crypto, FX, metals and oil.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "ForeSmart",
          url: "https://foresmart4.store",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Pre-hydration language bootstrap: sets <html lang/dir/class> from
  // localStorage BEFORE React mounts to prevent any mixed-language flash.
  const bootstrap = `(function(){try{var l=localStorage.getItem('lang');if(l!=='ar'&&l!=='en'){var n=(navigator.language||'').toLowerCase();l=n.indexOf('ar')===0?'ar':'en';}var h=document.documentElement;h.lang=l;h.dir=l==='ar'?'rtl':'ltr';h.classList.remove('lang-ar','lang-en');h.classList.add('lang-'+l);}catch(e){}})();`;
  return (
    <html lang="ar" dir="rtl" className="lang-ar">
      <head><HeadContent /></head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  if (typeof window !== "undefined") {
    // Lazy install once per browser session.
    void import("@/lib/observability/client").then((m) => m.installClientObservability());
  }
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={150}>
            <Outlet />
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
