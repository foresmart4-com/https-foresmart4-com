import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";

type Lang = "ar" | "en";
type Dict = Record<string, unknown>;

const DICTS: Record<Lang, Dict> = { en: en as Dict, ar: ar as Dict };

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: "rtl" | "ltr";
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
  formatCurrency: (n: number, currency?: string) => string;
  formatDate: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<Ctx | null>(null);

function lookup(dict: Dict, key: string): string | undefined {
  if (key in dict && typeof (dict as any)[key] === "string") return (dict as any)[key] as string;
  const parts = key.split(".");
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return "ar";
  try {
    const stored = localStorage.getItem("lang");
    if (stored === "ar" || stored === "en") return stored;
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("ar") ? "ar" : "en";
  } catch {
    return "ar";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  // Hydrate from localStorage / navigator after mount (SSR safe).
  useEffect(() => {
    setLangState(detectInitialLang());
  }, []);

  // Load saved language from user profile after auth.
  useEffect(() => {
    let cancelled = false;
    const loadProfileLang = async (userId: string) => {
      try {
        const { data } = await supabase.from("profiles").select("language").eq("id", userId).maybeSingle();
        if (cancelled) return;
        const l = data?.language as Lang | undefined;
        if (l === "ar" || l === "en") {
          setLangState(l);
          try { localStorage.setItem("lang", l); } catch { /* noop */ }
        }
      } catch (err) {
        console.warn("[i18n] failed to load profile language", err);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.id) void loadProfileLang(session.user.id);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) void loadProfileLang(session.user.id);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const h = document.documentElement;
      h.lang = lang;
      h.dir = lang === "ar" ? "rtl" : "ltr";
      h.classList.remove("lang-ar", "lang-en");
      h.classList.add(`lang-${lang}`);
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { if (typeof window !== "undefined") localStorage.setItem("lang", l); } catch { /* noop */ }
    // Apply immediately so the next paint is in the new language.
    if (typeof document !== "undefined") {
      const h = document.documentElement;
      h.lang = l;
      h.dir = l === "ar" ? "rtl" : "ltr";
      h.classList.remove("lang-ar", "lang-en");
      h.classList.add(`lang-${l}`);
    }
    // Persist to profile (fire-and-forget).
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) return;
      supabase.from("profiles").upsert({ id: uid, language: l, updated_at: new Date().toISOString() }).then(({ error }) => {
        if (error) console.warn("[i18n] failed to persist language", error.message);
      });
    });
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const primary = lookup(DICTS[lang], key);
    if (primary !== undefined) return interpolate(primary, vars);
    const fallback = lookup(DICTS.en, key);
    if (fallback !== undefined) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing '${lang}' translation for key: ${key} (using en fallback)`);
        missingKeys.add(`${lang}:${key}`);
      }
      return interpolate(fallback, vars);
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing translation for key: ${key}`);
      missingKeys.add(`*:${key}`);
    }
    return key;
  }, [lang]);

  const formatters = useMemo(() => {
    const locale = lang === "ar" ? "ar-SA" : "en-US";
    return {
      formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, opts).format(n),
      formatCurrency: (n: number, currency = "USD") =>
        new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n),
      formatDate: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => {
        const date = d instanceof Date ? d : new Date(d);
        return new Intl.DateTimeFormat(locale, opts ?? { dateStyle: "medium" }).format(date);
      },
    };
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr", ...formatters }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
