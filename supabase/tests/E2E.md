# Manual end-to-end test (local Supabase only)

These accounts exist only in the **local** Supabase stack (`npx supabase start`). Never create them on the live project.

| Role | Email | Password |
|---|---|---|
| Seller | seller.e2e@example.com | E2e-Local-Pass-2026 |
| Collector | collector.e2e@example.com | E2e-Local-Pass-2026 |
| Business (needs approval) | business.e2e@example.com | E2e-Local-Pass-2026 |
| Admin | the seller account, promoted with the SQL snippet | — |

## Setup

```bash
npx supabase start                       # from the repo root
# build the app against the local stack (values from `npx supabase status`)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key> \
npm --prefix frontend run build
npx serve@14 -l 4173 frontend/out        # http://localhost:4173
```

Confirmation emails land in Mailpit: http://127.0.0.1:54324

## Flow

1. Sign up as the seller → "Check your email" → open the link from Mailpit → lands on /dashboard signed in.
2. Post a listing with 2 photos and a pin → appears in the dashboard and on /find.
3. Sign out. As a visitor, /find shows the listing but "Sign in to WhatsApp or call".
4. Sign up as the collector → near-me / filters find the listing → "Request to claim".
5. As the seller, accept the request → the listing is claimed and leaves /find.
6. Promote the admin in SQL, sign in as them → stats, users with emails, listings, CSV.
