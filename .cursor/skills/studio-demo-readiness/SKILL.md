---
name: studio-demo-readiness
description: >-
  Pre-demo checklist for high-volume shops and photo studios using ManageMyShop
  (services, inventory, POS, parties, invoices, staff). Use when preparing client
  demos, studio onboarding, Birtamode / photo studio visits, or verifying
  production readiness for service businesses.
---

# Studio / High-Volume Shop Demo Readiness

Photo studios and similar shops use **Services** (jobs), **Quick POS** (walk-in sales), **Inventory** (frames/albums/consumables), **Parties** (clients + advances), **Reports/Ledger**, **Staff/Attendance**, and **print/thermal invoices**. There is no dedicated `photo_studio` type — use **`service`**.

## Recommended account setup

1. Business type: **Service Business** (`service`) — or Retail with services enabled
2. Settings → **Order Attributes** for services, e.g.:
   - Package / shoot type (select or text)
   - Event / shoot date
   - Delivery date
   - Photographer / assigned staff
   - Album size / finish notes
3. Inventory categories: Frames, Albums, Prints, Consumables
4. Inventory items: mix of `goods` (stocked) + `service` (non-stock fee lines if needed)
5. Sample parties: walk-in + 2–3 named clients with prior balances
6. Staff members + attendance punch path verified
7. Subscription: ensure plan unlocks inventory, sales, services, parties, reports, staff

## Demo script (happy path)

Walk this order so every core module is hit:

1. **Dashboard** — KPIs load with business selected in Topbar
2. **Inventory** — search, create/edit item, restock, low stock visible if applicable
3. **Parties** — create client, open statement / ledger feel
4. **Services** — new job with dynamic attributes + attachment upload + status change + print A4/thermal
5. **Quick POS** — multi-item cart, party select, cash/bank pay, receipt/thermal
6. **Sales** list — new sale appears; open invoice URL
7. **Purchases/Expenses** — one expense entry
8. **Reports** — overview + ledger + service/sales tabs (avoid relying on Excel export)
9. **Tasks** — create task, confirm notification bell updates
10. **Staff** — open member; salary only if backend salary API is live (see risks)
11. **Attendance** — staff role punch-in/out (owners are redirected away from `/app/attendance`)

Skip cafe **Orders / Tables / Billing** unless the client is F&B.

## Pre-demo technical checklist

Copy and track:

```
Demo readiness:
- [ ] API base URL points at stable backend (not broken localhost on client device)
- [ ] Business selected in Topbar before any module call
- [ ] Service business type + order attributes configured
- [ ] Seed data: products, parties, 1–2 open service jobs
- [ ] Thermal + A4 print smoke-tested on the demo device/printer
- [ ] SSE stream connects (POS/tasks refresh without full page reload)
- [ ] Salary endpoints return real data (no mms_mock_salary_* reliance)
- [ ] yarn build succeeds; critical paths smoke-tested on production build
- [ ] Subscription not expired; features not permission-blocked for demo user
- [ ] Nepali locale toggle checked if client prefers NE
- [ ] No owner demo of Attendance page (staff-only RoleGuard)
```

## Known demo risks (fix or avoid showing)

| Risk | Where | Mitigation |
|------|--------|------------|
| Salary mock fallback | `api.js`, `StaffSalaryProfile.jsx` | Confirm backend salary APIs; avoid payroll deep-dive if 404 |
| JWT in SSE query string | `hooks/useSSE.js` | Prefer private network / HTTPS; do not log full EventSource URLs |
| `limit: 500` list loads | POS, Sales, products/parties API defaults | Use search; keep seed inventory reasonable for demo |
| Custom date range disabled | Attendance, Reports | Use preset ranges only |
| Excel export unavailable | Reports i18n / missing endpoint | Do not promise Excel in pitch |
| Hardcoded EN on receipts | `ThermalReceipt.jsx`, parts of Invoice | Prefer EN demo or note NE gaps |
| Monolith pages | Services ~4.5k, Reports ~3.7k, QuickPos ~3.2k | Don't live-edit these in front of client |
| Failing Vitest suite | 11 files / AuthProvider + mock issues | Don't block demo on tests; fix before merge |

## Pitch mapping (studio language → app)

| They say | Show |
|----------|------|
| Booking / order / album job | Services + order attributes + attachments |
| Counter sale (frame, reprint) | Quick POS |
| Customer advance / due | Parties + party transactions + ledger |
| Photographer workload | Tasks + staff |
| Stock of frames/paper | Inventory + purchases |
| Bill / invoice | Invoice page + thermal print |
| Daily sales | Dashboard + Reports |

## If something breaks live

1. Confirm Topbar **business** is set
2. Hard refresh once (PWA cache) via `PwaLifecycle` / reload
3. Re-login if 401 cleared session
4. Fall back to Sales/Services list + Invoice print if POS SSE stalls
5. Never open browser console mock salary keys in front of client

## Related

- [managemyshop-architecture](../managemyshop-architecture/SKILL.md)
- [mms-feature-dev](../mms-feature-dev/SKILL.md)
