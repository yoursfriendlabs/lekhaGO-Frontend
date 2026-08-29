# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 5173
npm run build     # Production build
npm run preview   # Preview production build
```

No test runner is configured. No lint scripts are defined.

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
| `src/pages/<domain>/` | Route screens |
| `src/components/{layout,ui,form,<domain>}/` | Chrome, primitives, feature UI |
| `src/lib/` | API, auth, i18n; grouped helpers (`dates`, `money`, `business`) |
| `src/hooks/` | SSE and shared hooks |
| `src/stores/` | Zustand business-scoped lists |

### Routing (`src/app/`)

Three tiers:
- **Public:** `/`, `/login`, `/register`
- **Protected shell** (`/app/*`): `AppShell` with Sidebar, Topbar, MobileNav
- Guards live in `src/app/guards.jsx`

### Context Providers (all in `src/lib/`)

| File | Context | Purpose |
|------|---------|---------|
| `auth.jsx` | `AuthContext` | JWT token, user, businessId; persisted in localStorage (`mms_token`, `mms_user`, `mms_business_id`) |
| `i18n.jsx` | `I18nContext` | `useI18n()` → `{ t, language, setLanguage }`. Keys are dot-notation e.g. `t('common.add')` |
| `theme.jsx` | `ThemeContext` | Theme stub; currently hard-coded to light |

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
- Prefer `@/` imports for new files
- List data uses Zustand scoped stores; local `useState` for form UI
- All user-visible strings should use `t('key')` from `useI18n()`
- Business context must be set in Topbar before making most API calls; missing `businessId` causes API errors
- `components/orders/DynamicAttributes.jsx` handles custom order fields; `components/form/FileUpload.jsx` handles `POST /api/uploads/attachment`

### Deployment

Dockerfile + `nginx.conf` for containerized static hosting.
