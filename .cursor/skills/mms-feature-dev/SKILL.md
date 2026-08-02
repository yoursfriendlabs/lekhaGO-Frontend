---
name: mms-feature-dev
description: >-
  How to add or change ManageMyShop frontend features safely: API methods,
  routes, business-type modules, i18n, stores, guards, print, and SSE. Use when
  implementing new pages, endpoints, settings tabs, POS/service flows, or
  fixing module access bugs.
---

# ManageMyShop Feature Development

## Before coding

1. Confirm which **business types** need the feature (`businessProfile.js` modules/nav)
2. Confirm **subscription / accessControl** feature key (match existing keys used in `SubscriptionFeatureRoute`)
3. Confirm API exists on backend; add `api.*` wrapper before UI wiring
4. Prefer extending an existing page/panel over a new orphan route

## Checklist for a typical feature

```
Feature progress:
- [ ] api.js method + cache tags / invalidation on mutate
- [ ] Route in App.jsx (lazy) + guard (subscription/role) if needed
- [ ] Nav via businessProfile and/or businessTypeConfig
- [ ] canViewFeature / canManageFeature respected in UI actions
- [ ] i18n keys in both `en` and `ne` in i18n.jsx
- [ ] Loading / empty / error states (Notice or snackbar)
- [ ] Mobile layout acceptable (MobileNav exists; forms may use MobileFormStepper)
- [ ] No new silent mock/localStorage data fallbacks
- [ ] Vitest for pure lib helpers when logic is non-trivial
```

## API patterns

```js
// Read — use cache tags so SSE / mutations can invalidate
api.listThings = (params) =>
  request('/api/things', { params, cacheTags: ['things'] });

// Write — invalidate related tags
api.createThing = (body) =>
  request('/api/things', { method: 'POST', body, invalidateTags: ['things', 'dashboard'] });
```

- Throw-through errors; pages catch and show `Notice` / snackbar
- Collections: always normalize with `getCollectionItems(response)`
- Lookups for typeahead: prefer `lookup*` endpoints over loading `limit: 500`

## List state

Use Zustand scoped stores (`stores/createScopedListStore.js`) when multiple screens share a business-scoped list. Scope key = `businessId`. Call `fetch(params, true)` to force refresh after mutations or SSE.

## Routing

```jsx
const NewPage = lazy(() => import('./pages/NewPage'));
// inside /app/* routes:
<Route path="new-thing" element={
  <SubscriptionFeatureRoute featureKey="things">
    <NewPage />
  </SubscriptionFeatureRoute>
} />
```

Redirect legacy paths instead of leaving duplicate pages.

## Business profile

When a module should appear only for some types:

1. Set `modules.yourModule` in each type in `businessProfile.js`
2. Add nav item under that type’s `navigation` (or inject in `businessTypeConfig.js` if cross-cutting like staff/attendance)
3. Gate page body with profile/settings `enabledModules` when needed

For studio-like custom fields, prefer **Order Attributes** + `DynamicAttributes` over hardcoding fields into Services/Sales.

## i18n

```js
t('section.key')
t('section.keyWithVar', { name: value })
```

Add keys to both locale trees in `lib/i18n.jsx`. Do not ship user-facing English literals in new UI (existing gaps in Cafe/Invoice/Thermal are debt — don’t expand them).

## Realtime

If the screen must stay fresh under multi-user load:

1. Ensure backend emits an SSE event
2. Map it in `hooks/useSSE.js` `EVENT_MAP` (window event + invalidateTags)
3. Listen with `useSSEEvent` / `window.addEventListener` and refetch

## Print

- A4: render a ref’d DOM → `printElement(ref.current)`
- Thermal 80mm: `ThermalReceipt` + `printThermalReceipt`
- Keep print markup semantic and light on interactive chrome

## Anti-patterns

- Hardcoding `localhost` URLs outside API_BASE
- Bypassing `api.request` with raw `fetch` (misses auth/business headers)
- Owner-only assumptions without `RoleGuard` / accessControl checks
- Client-only pagination after fetching unbounded lists on high-volume screens
- Duplicating password/settings forms — reuse `AccountSecurityPanel`, settings panels
- Committing `.env` or tokens

## Verify

```bash
yarn test
yarn build
```

Smoke: login → select business → hit new route → mutate → refresh/SSE → print if applicable.

## Related

- [managemyshop-architecture](../managemyshop-architecture/SKILL.md)
- [studio-demo-readiness](../studio-demo-readiness/SKILL.md)
