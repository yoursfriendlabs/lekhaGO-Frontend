---
name: managemyshop-architecture
description: >-
  Architecture, conventions, and patterns for the ManageMyShop / PasalManager
  React frontend. Use when editing pages, API calls, auth, i18n, business types,
  stores, routing, print/receipts, SSE, or subscription guards in this repo.
---

# ManageMyShop Architecture

React 19 + Vite 6 + Tailwind 3 dashboard for inventory, sales, purchases, services, parties. Brand in UI/PWA: **PasalManager**. Package manager: **Yarn 4**.

## Commands

```bash
yarn dev       # port 5173
yarn build
yarn test      # vitest run
yarn preview   # build + wrangler dev
yarn deploy    # build + wrangler deploy
```

Env: copy `.env.example` → `.env`, set `VITE_API_BASE_URL` (default `http://localhost:4000`).

## Layout

| Path | Role |
|------|------|
| `src/pages/` | Route screens (lazy-loaded in `App.jsx`) |
| `src/components/` | Shared UI, settings panels, tasks, subscription |
| `src/lib/` | API, auth, i18n, theme, business profile, print, payments |
| `src/hooks/` | SSE, task notifications, debounce, mobile, loading |
| `src/stores/` | Zustand scoped list stores (parties, products, sales, …) |

## Routing & guards

- Public: `/`, `/login`, `/register`, auth recovery flows
- Protected shell: `/app/*` — Sidebar, Topbar, MobileNav, `useSSE()`, subscription banners
- Guards: `ProtectedRoute`, `PublicOnlyRoute`, `EmailActivationRequiredRoute`, `RoleGuard`, `SubscriptionFeatureRoute`, `InvoiceAccessRoute`
- Feature access via `useAuth().canViewFeature` / `canManageFeature` (subscription + accessControl)
- Orphaned (do not revive without reason): `Products.jsx`, `QuickEntry.jsx`, `OrderAttributes.jsx` — order attributes live in Settings

## Context & state

| Source | Purpose |
|--------|---------|
| `lib/auth.jsx` | JWT, user, businessId, role, subscription, feature gates |
| `lib/i18n.jsx` | `useI18n()` → `{ t, locale, setLocale }` — EN + Nepali |
| `lib/theme.jsx` | Stub light-only; dark classes are inert |
| `lib/businessSettings.jsx` | Business settings provider |
| `lib/snackbar.jsx` | Toasts |
| `stores/*` | Business-scoped lists via `createScopedListStore` |

Persistence keys in `lib/storage.js`: `mms_token`, `mms_user`, `mms_business_id`, etc.

## API (`lib/api.js`)

- All HTTP through `request(path, options)` → injects `Authorization` + `x-business-id`
- Errors: `Error` with `.status`, `.payload`; 401/inactive → clear session → `/login`
- GET cache + inflight dedupe; mutate via `invalidateApiCache` / tags
- Prefer named `api.*` methods; normalize lists with `getCollectionItems`
- Uploads: `FormData` via `uploadAttachment` / `uploadAttachments`

**Do not** add silent localStorage mock fallbacks for production data (salary already has `mms_mock_salary_*` — treat as tech debt).

## Business types (`lib/businessProfile.js`)

Types: `retail`, `jewellery`, `cafe`, `service`, `general_store`, `hospitality`, …

- Nav + modules driven by profile (`modules`, `navigation`, `salesFlow`, `servicesFlow`)
- `businessTypeConfig.js` injects cafe tables/billing, attendance, staff into nav
- Photo studios / job shops → use **`service`** (or `retail` with services enabled)
- Custom fields: Settings → Order Attributes + `DynamicAttributes.jsx`

## UI conventions

- Classes: `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.label`, `.glass` in `styles.css`
- Colors: `primary` (#9b6835), `secondary`, `ink`, `mist`
- Fonts: Space Grotesk + Fraunces
- User-visible strings: `t('dot.key')` with EN + `ne` entries in `i18n.jsx`
- Prefer existing components (`SearchableSelect`, `PartySearchCreateField`, `Pagination`, dialogs) over new primitives

## Realtime & print

- SSE: `hooks/useSSE.js` → `/api/events/stream?token=&businessId=` (EventSource cannot set headers)
- Window events: `mms:sse:sales-changed`, `tasks-changed`, `tables-changed`
- Print: `lib/print.js` — `printElement` (A4), `printThermalReceipt` (80mm); UI in `Invoice.jsx`, `ThermalReceipt.jsx`

## Performance defaults for high volume

- Prefer server pagination / `lookup*` search over `limit: 500` full dumps
- Invalidate caches by tag after mutations; listen to SSE on busy screens (POS, orders, tasks)
- Avoid growing monolith pages further (`Services`, `Reports`, `QuickPos`); extract shared helpers when touching them

## Docs drift to remember

- AGENTS/CLAUDE may say React 18 / no tests — reality: React 19 + Vitest
- Keep agent docs in sync when changing stack or scripts

## Related skills

- [studio-demo-readiness](../studio-demo-readiness/SKILL.md) — client demo / high-volume shop checklist
- [mms-feature-dev](../mms-feature-dev/SKILL.md) — how to add or change a feature safely
