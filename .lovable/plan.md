# Wakuja Shop POS — v1 build plan

## What I'll ship in this pass

A single responsive PWA on TanStack Start + TypeScript + Tailwind + shadcn, wired to **your own Supabase**, ready to push to **your own Vercel**. Includes both open items (shift reconciliation, image fallback).

### Deliverables

1. **`supabase/migrations/0001_init.sql`** — one runnable migration containing:
   - All 10 tables per spec (`shops, users, products, stock_movements, sales, sale_items, customers, customer_payments, suppliers, expenses`) + `till_sessions` for shift/reconciliation.
   - Enums: `user_role`, `stock_movement_type`, `payment_method`, `lipa_namba_provider`, `sale_type`, `sale_status`, `expense_category`.
   - `shop_id` FK on every business table (multi-branch ready).
   - Trigger to auto-recalculate `products.current_stock` from `stock_movements` (append-only ledger; never edited directly).
   - Trigger to write a `sale_deduction` stock_movement row per `sale_items` insert.
   - Views: `v_customer_balances` (deni per customer), `v_sales_daily` / `v_sales_weekly` / `v_sales_monthly`, `v_profit`, `v_best_sellers`, `v_low_stock`.
   - `has_role(uuid, user_role)` SECURITY DEFINER function.
   - **RLS enforced at DB level** — cashiers get zero access to `buying_price`, `expenses`, `suppliers`, `stock_movements`, customer debt. Owner sees all. Products exposed to cashiers via a `v_products_pos` view that strips `buying_price`.
   - Per-shop scoping on every policy (`shop_id = current user's shop_id`).
   - GRANTs to `authenticated` and `service_role` per Lovable rules.
   - Trigger on `auth.users` insert → creates `public.users` row.

2. **App structure** (TanStack Start file-based routing):

   ```
   /auth                          — shared phone/email + password login
   /_authenticated/               — owner-only subtree (RBAC guard in beforeLoad)
     dashboard, products, products/new, products/$id,
     inventory, sales, sales/$id, customers, customers/$id,
     suppliers, expenses, reports, settings
   /_cashier/                     — cashier-only subtree
     pos (home), today, insights, profile
     till/open, till/close
   /receipts/$saleId              — printable HTML receipt
   ```

3. **POS flow** (offline-first):
   - IndexedDB queue (via `idb` lib) for sales when offline; `synced` flag.
   - Background sync loop: retries on `navigator.onLine` + focus + 30s interval.
   - Cart slide-up on mobile / right rail on desktop, quantity steppers, inline discount (hidden entirely if cashier lacks permission).
   - Checkout: Cash / Lipa Namba (+ provider) / Credit (customer picker with inline "add new").
   - Confirm screen → receipt preview with Print (window.print) + Share buttons.
   - Sync-status pill near receipt number.

4. **Deni feature** (given the most polish):
   - Dashboard "Customers with debt" card, sorted by largest balance.
   - Customer detail: purchase history, payment history, "Record payment" modal.
   - Balance computed from `v_customer_balances` — never stored.
   - Receipt shows "Malipo yajayo: [balance]" on credit sales.

5. **Owner screens**: dashboard, products (soft delete), inventory + stock movement log, sales list w/ filters + reprint, customers, suppliers, expenses, reports (single flexible screen w/ switcher), settings (shop info, logo upload to Supabase Storage, receipt footer, cashier management, per-cashier discount + till permissions).

6. **Cashier screens**: POS, Today's sales (no cost/profit shown), Low stock + Top sellers combined, Profile/logout, Till open/close with cash count reconciliation.

7. **Shift reconciliation** (`till_sessions`): opening float → sales during session (auto-joined by `opened_at` range and `cashier_id`) → cash count on close → variance shown to cashier + logged for owner.

8. **PWA**: manifest.json, service worker (Vite PWA plugin), installable on iOS + Android home screen, offline shell caching.

9. **Design**: blue anchor (`oklch(0.55 0.18 250)` primary), neutral gray/white palette, rounded-2xl, soft shadows, Inter/Figtree typography, generous whitespace. Consumer-app feel on cashier screens, denser data-density on owner screens — one shared token set.

10. **Deployment prep** (for you to run):
    - `vercel.json` + TanStack Start Vercel preset in `vite.config.ts`.
    - `README-DEPLOY.md` with exact steps: (a) create Supabase project, (b) run migration, (c) create Vercel project pointing at repo, (d) set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, (e) add custom domain.

## What I need from you before starting

Paste these three values (I'll store `VITE_SUPABASE_*` in the project so preview works, and you keep service role for Vercel only):

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the anon/publishable key
- Confirm: is there a **seed owner user** already in your Supabase Auth, or should the migration seed one shop row and I add a small "first-run bootstrap" that promotes the first signup to owner?

## Honest scope notes

- **One-shot with realistic depth**: I'll ship every screen and both roles wired end-to-end, but fine polish (empty states on every list, animation tuning, printer paper-size tweaks, exhaustive input validation) will need a follow-up pass once you use it. Not a demo — a working v1 with rough edges.
- **Receipts**: HTML + `window.print()`, styled for 80mm and A4. No ESC/POS.
- **No payment gateway** — recording only.
- **Testing**: I'll typecheck and smoke-test key flows in the preview; you'll want to do a real POS session before going live.

## Technical stack notes

- Router: TanStack Router file-based routing under `src/routes/`.
- Data: TanStack Query + `createServerFn` (auth-gated via `requireSupabaseAuth`) for owner data; direct browser Supabase client for POS reads (needs to work offline).
- Offline queue: `idb-keyval` for simplicity + custom sync worker.
- RBAC: `beforeLoad` guard reads `user_roles` via server fn, redirects cashiers away from owner routes; RLS is the actual enforcement.
- Forms: react-hook-form + zod.
- Toasts: sonner (already in template).

Reply with the three items above (or "seed the first owner") and I'll start building.
