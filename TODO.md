# Sentry: Error Reporting for All Environments

## Progress Tracking

- [x] **Step 1: Analyze Sentry configuration** — Reviewed all files
- [x] **Step 2: Plan approved by user**
- [x] **Step 3: Edit `src/main.jsx`** — Removed `beforeSend` filter that blocked non-production events; Sentry now captures all errors
- [x] **Step 4: Edit `src/lib/api.js`** — Removed `if (import.meta.env.PROD)` guard; API errors now captured in all environments
- [x] **Step 5: Edit `src/pages/QuickPos.jsx`** — Removed `if (import.meta.env.PROD)` guard and `if (import.meta.env.PROD) return null` for ErrorButton
- [x] **Step 6: Verify** — Build verified successfully
