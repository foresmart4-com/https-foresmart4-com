## Plan: Full i18n System + Growth Portfolio Restoration

### Part 1 — Centralized i18n Architecture

**1. Translation files**
- Create `src/locales/ar.json` and `src/locales/en.json` with namespaces: `common`, `nav`, `dashboard`, `markets`, `subscription`, `portfolio`, `signals`, `alerts`, `settings`, `billing`, `footer`, `notifications`, `errors`, `empty`, `seo`.
- Migrate every key currently in `src/lib/i18n.tsx` `dict` into these JSON files and expand with the missing surfaces.

**2. Rewrite `src/lib/i18n.tsx`**
- Load both JSON dictionaries statically (small, fine to bundle).
- `t(key)` accepts dot-paths like `dashboard.title`. Fallback chain: current lang → English → key.
- Default language detection: 
  1. Saved profile language (loaded post-auth via a new `useUserLanguage` effect)
  2. `localStorage.lang`
  3. `navigator.language.startsWith('ar') ? 'ar' : 'en'`
- Persist to `localStorage` on every change.
- Expose `formatDate`, `formatNumber`, `formatCurrency` helpers using `Intl` with `ar-SA` / `en-US` locales — for charts/tables/tooltips.
- Keep the old flat `t(key)` API working for legacy callers by aliasing flat keys to `common.*`.

**3. Profile persistence**
- Add `language` column to `profiles` table via migration (text, default `'ar'`, check `in ('ar','en')`).
- On login (`auth.tsx` / root auth listener), fetch `profiles.language` and call `setLang` if present.
- On `setLang`, if user is signed in, update `profiles.language` (fire-and-forget).

**4. Language selector**
- Build `<LanguageSwitcher />` component (compact + full variants).
- Mount in: Settings page, desktop sidebar footer (`_app.tsx`), mobile sidebar sheet.

**5. RTL/LTR**
- Already handled by current provider (`document.dir`). Verify all custom panels use logical properties (`ms-*`, `me-*`, `start/end`) — fix any `ml-/mr-/left-/right-` in headers, nav, footer.

**6. SEO**
- Update each route's `head()` to return localized `title` + `description`. Where `head()` is static, convert to function reading the current lang from a server-safe lookup OR set `<title>` from inside the component via TanStack `useDocumentHead` equivalent. Practical approach: localize from inside the component using `useEffect` on `document.title` for the routes where SSR-time language can't be known.

**7. Sweep hardcoded strings**
- Pages to convert: `routes/_app/dashboard.tsx`, `markets.tsx`, `subscription.tsx`, `portfolios.tsx`, `signals.tsx`, `alerts.tsx`, `settings.tsx`, `billing.tsx`, plus `LegalFooter.tsx`, toast notifications, error boundaries, empty-state components.
- Replace inline `lang === 'ar' ? 'X' : 'Y'` patterns with `t('namespace.key')`.

### Part 2 — Growth Portfolio Restoration

**1. Investigate**
- Read `src/services/investment/planEngine.ts`, `routes/_app/portfolios.tsx`, dashboard summary components, and `InvestmentPlansPanel.tsx` to find where "Growth" was removed during the SaaS pivot.

**2. Restore Growth plan**
- Add Growth plan entry alongside Starter/Pro/Elite (or as a portfolio risk profile: Conservative / **Growth** / Aggressive depending on existing schema).
- Wire into:
  - `portfolios.tsx` selector
  - `InvestmentPlansPanel.tsx`
  - Dashboard summary cards
- Provide deterministic mock data when backend returns nothing: allocation, risk score, perf chart series, historical growth.

**3. Resilience**
- Add try/catch + `console.error` around portfolio loading.
- Loading skeleton + empty state (localized).
- Both AR + EN labels in locale JSON under `portfolio.growth.*`.

**4. Constraints**
- No theme, layout, or sidebar redesign.
- No backend trading logic changes.

### Technical notes

- JSON imports: TanStack Start + Vite handle `import en from '@/locales/en.json'` natively.
- The dict file is small enough (<50KB combined) to ship in the main bundle; no async loading needed.
- For server-rendered SEO titles, default to Arabic (matches default) and let the client effect override post-hydration.
- Existing `useI18n` consumers (~30+ files) keep working via the flat-key alias layer; new code uses dot paths.

### Out of scope
- No changes to design tokens, color palette, fonts, or component layouts.
- No new routes.
- No real-money / broker behavior changes.
