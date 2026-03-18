# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**ManageMyShop** is a React 18 + Vite + Tailwind CSS business management dashboard for inventory, sales, purchases, services, and parties. It targets small/medium shops with multi-business support and English/Nepali (i18n).

### Routing (`src/App.jsx`)

Three tiers:
- **Public:** `/`, `/login`, `/register`
- **Protected shell** (`/app/*`): wraps authenticated routes in a layout with Sidebar, Topbar, MobileNav
- `ProtectedRoute` redirects to `/login` if no token

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

- Pages live in `src/pages/`, reusable UI in `src/components/`
- State is local `useState` or React Context — no Redux/Zustand
- All user-visible strings should use `t('key')` from `useI18n()`
- Business context must be set in Topbar before making most API calls; missing `businessId` causes API errors
- `DynamicAttributes.jsx` handles custom order fields; `FileUpload.jsx` handles attachment uploads to `POST /api/uploads/attachment`

### Deployment

Dockerfile + `nginx.conf` for containerized static hosting.
