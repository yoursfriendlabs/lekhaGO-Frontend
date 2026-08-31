# Frontend structure

## Current layout

```
src/
  app/                 # boot: providers, guards, routes, AppShell
  pages/<domain>/      # route screens only
  components/
    layout/            # chrome
    ui/                # primitives
    form/              # inputs
    <domain>/          # feature-only widgets
  lib/                 # api.js, auth.jsx, i18n.jsx stay at root (name collisions)
    dates/ money/ business/ print/ compliance/ inventory/ integrations/
  hooks/
  stores/
```

Import alias: `@/` → `src/` (use this for new files).

## Where new code goes

| If you are adding… | Put it in… |
|---|---|
| A new screen | `src/pages/<domain>/` + lazy import in `src/app/pages.js` + route in `AppShell.jsx` |
| UI used on one feature | `src/components/<domain>/` |
| UI used in 3+ features | `src/components/ui/` or `form/` |
| API method | `src/lib/api.js` for now; split by domain when a section exceeds ~200 lines |
| Date / money / party math | `src/lib/dates`, `money`, existing helpers — never inside a page |
| i18n string | `src/lib/i18n.jsx` both `en` and `ne` |

Do not add files next to `main.jsx`. Do not grow `App.jsx` — it is only a re-export.

## Next splits (do these as you touch the files, not as a big-bang)

1. **Break god pages.** `Services.jsx` (~4.6k), `Reports.jsx`, `QuickPos.jsx`, `Purchases.jsx`, `Inventory.jsx` should become `pages/<domain>/` + colocated `components/` and `hooks/`. Extract a form, a list, and a print/preview first.
2. **Split `api.js`.** Keep `request()` + cache in `lib/api/client.js`; move resource methods to `lib/api/products.js`, `sales.js`, etc. Re-export from `lib/api.js` so callers do not churn.
3. **Split `i18n.jsx`.** One file per domain (`i18n/en/inventory.js`) assembled in `i18n/index.jsx`.
4. **Colocate tests** with the module they cover (already true for most).
5. **Do not introduce Redux.** Zustand stores + React context are enough at 100 shops. Add React Query only if list caching in `api.js` becomes unmaintainable.

## Rules that keep this from rotting

- One domain folder owns that feature's widgets. Settings panels stay under `components/settings/`.
- A page file over ~800 lines is a signal to extract, not to add more JSX.
- Cross-imports: `pages` may import `components` and `lib`. `components/ui` must not import pages or stores.
- Backend contract changes land in `lib/api.js` first, then UI.
