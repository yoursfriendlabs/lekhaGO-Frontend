# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev       # Start dev server on port 5173
yarn build     # Production build
yarn test      # Vitest
yarn preview   # Preview production build
```

## Environment

Copy `.env.example` to `.env` and set:
```
VITE_API_BASE_URL=http://localhost:4000
```

## Architecture

**PasalManager / ManageMyShop** is a React 19 + Vite 6 + Tailwind CSS dashboard. Alias `@/` maps to `src/`.

### Folder layout

| Path | Role |
|------|------|
| `src/app/` | Providers, route guards, lazy page map, AppShell |
| `src/pages/<domain>/` | Route screens (`auth`, `inventory`, `sales`, `services`, …) |
| `src/components/layout/` | Sidebar, Topbar, MobileNav, error boundary |
| `src/components/ui/` | Shared primitives (Notice, Pagination, Dialog) |
| `src/components/form/` | Inputs (dates, selects, uploads, payments) |
| `src/components/<domain>/` | Feature UI (`parties`, `inventory`, `staff`, `settings`, …) |
| `src/lib/` | API client, auth, i18n, plus grouped helpers (`dates`, `money`, `business`) |
| `src/hooks/` | SSE, debounce, mobile |
| `src/stores/` | Zustand business-scoped lists |

Put new code next to its domain. Do not add files to the `src/` root.

### Routing (`src/app/`)

Three tiers:
- **Public:** `/`, `/login`, `/register`
- **Protected shell** (`/app/*`): `AppShell` with Sidebar, Topbar, MobileNav
- `ProtectedRoute` / `SubscriptionFeatureRoute` live in `src/app/guards.jsx`

### Context Providers

| File | Purpose |
|------|---------|
| `lib/auth.jsx` | JWT, user, businessId (`mms_token`, `mms_user`, `mms_business_id`) |
| `lib/i18n.jsx` | `useI18n()` → `{ t, language, setLanguage }` |
| `lib/theme.jsx` | Theme; light is the production default |
| `lib/business/businessSettings.jsx` | Per-business settings |

### API Layer (`src/lib/api.js`)

All requests go through the `request(path, options)` helper which:
- Reads `VITE_API_BASE_URL` (defaults to `http://localhost:4000`)
- Auto-injects `Authorization: Bearer {token}` and `x-business-id: {businessId}` headers
- Throws errors with `.status` and `.payload` attached

Named exports correspond to REST resources: `getProducts`, `createSale`, `getParty`, etc. File uploads use `FormData` multipart.

### Styling

- **Tailwind** with custom color palette: `primary` (brown #9b6835), `secondary`, `ink` (text), `mist` (background)
- **Fonts:** Space Grotesk (sans), Fraunces (serif)
- Global component classes in `src/styles.css`: `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.label`, `.glass`
- Print styles configured for invoice printing

### Key Conventions

- Pages live in `src/pages/<domain>/`, shared UI in `src/components/{layout,ui,form,<domain>}/`
- Prefer `@/` imports for new files (e.g. `@/lib/api`)
- List data uses Zustand scoped stores; local `useState` for form UI
- All user-visible strings should use `t('key')` from `useI18n()`
- Business context must be set in Topbar before making most API calls; missing `businessId` causes API errors
- `components/orders/DynamicAttributes.jsx` handles custom order fields; `components/form/FileUpload.jsx` handles `POST /api/uploads/attachment`

### Deployment

Dockerfile + `nginx.conf` for containerized static hosting.
