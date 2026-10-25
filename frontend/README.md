# Re-සයිකල් LK — Frontend

A waste-exchange web app for Sri Lanka: people post plastic, glass, paper and e-waste that the municipal truck won't take, and collectors and recyclers find it on a map and get in touch over WhatsApp.

**Stack:** Next.js 16 (App Router) · Tailwind CSS 4 · shadcn/ui (Base UI) · GSAP · three.js · Leaflet + OpenStreetMap · Recharts

```bash
npm install
npm run dev      # http://localhost:3000
```

## Supabase (backend)

1. Copy `.env.example` to `.env.local` and fill in the project URL and the **publishable** key.
2. Run `npm run check:supabase`. It checks the auth service, the auth client and the database API.
3. The browser client is `src/lib/supabase/client.ts`. Import it with `import { supabase } from "@/lib/supabase/client"`.

### Database schema

The schema lives in `../supabase/migrations/20261025000000_initial_schema.sql`. To apply it, open Supabase Dashboard → **SQL Editor** → **New query**, paste the whole file, and click **Run**. Then run `npm run check:supabase` and every line should be ✓.

- **Extension:** PostGIS, installed in the `extensions` schema.
- **Tables:** `profiles` (auto-created on sign-up), `listings` (with a `geography(point)` location), `claims` and `reports`. Every table has Row Level Security.
- **RPCs:** `search_listings` (filters plus PostGIS near-me), `request_claim`, `respond_to_claim`, `cancel_claim` and `admin_stats`.
- **Storage:** a public `listing-photos` bucket. Users can only upload into `<their-user-id>/…`.
- **First admin:** sign up in the app, then run the `update public.profiles set role = 'admin' …` snippet at the bottom of the migration.

Test the migration locally before changing it. This needs Docker; the script runs the migrations and 21 RLS/workflow scenarios against a throwaway PostGIS container:

```bash
../supabase/tests/run.sh
```

The app is a static export, so the browser talks to Supabase directly. All access control lives in Row Level Security policies, and the secret/service_role key must never be used in this app. On Cloudflare Pages, add the same two `NEXT_PUBLIC_…` variables under **Settings → Environment variables**: they're inlined at build time.

## Pages

| Route | What it does |
|---|---|
| `/` | Home: three.js hero, GSAP scroll animations, how it works, materials, who it's for |
| `/find` | Map of Sri Lanka plus a list. Search, optional province/district filter, material chips, “Near me” radius, filters for quantity, date and sort. Listing detail has WhatsApp/Call buttons and claim/report actions |
| `/post` | Create a listing: material, title, kg, up to 4 photos, description, pickup window, and a pin dropped on the map |
| `/login`, `/signup` | Email or Google (mocked), with roles seller / collector / business / recycler |
| `/dashboard` | My listings and incoming claim requests (accept/decline), my outgoing claims, phone number |
| `/admin` | Analytics (listings per week, top materials, claim outcomes), user approvals, listing removal, reports, CSV export |

## Data & auth

Everything is live in Supabase. There is no demo data any more.

| Layer | File |
|---|---|
| Browser client | `src/lib/supabase/client.ts` |
| Auth (session, profile, email/password, Google, password reset) | `src/lib/auth.tsx` → `useAuth()` |
| All queries & mutations (+ row → type mappers) | `src/lib/supabase/api.ts` |
| Caching / refetching | TanStack Query (`QUERY_KEYS` in `api.ts`) |

- **Sign-up** sends `full_name`, `phone` and `role` as user metadata, and the `on_auth_user_created` trigger creates the profile. Email confirmation is on by default in Supabase, so the user sees "Check your email" first.
- **Google**: the role picked on the sign-up page is kept in localStorage across the redirect and applied with `choose_initial_role()` on first login.
- **Photos** are resized to JPEG in the browser and uploaded to `listing-photos/<user-id>/<uuid>.jpg` before the listing is inserted. If the insert fails, they're deleted again.
- **Find** calls `search_listings()`: text, province, district, materials, kg, date and PostGIS radius all run in the database.
- **Phone numbers** are only returned to signed-in users. Visitors see "Sign in to WhatsApp or call the seller".

### Supabase dashboard settings

1. **Authentication → URL Configuration**: set **Site URL** to your production URL, and add `http://localhost:3000/**` plus your Cloudflare URL(s) under **Redirect URLs**. Email links and Google sign-in only redirect to these.
2. **Authentication → Sign In / Providers → Google**: enable it with a Google Cloud OAuth client. In Google Cloud the authorised redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Make yourself admin**: sign up, then run in the SQL Editor:
   `update public.profiles set role = 'admin', approved = true where id = (select id from auth.users where email = 'you@example.com');`

### Local Supabase (optional)

`supabase/config.toml` is set up for the Supabase CLI. Running `npx supabase start` (needs Docker) gives you a full local stack with the same migrations, and Mailpit at http://127.0.0.1:54324 to read confirmation emails. To point a build at it, set the two `NEXT_PUBLIC_SUPABASE_*` env vars to the values `supabase status` prints.

## Scroll-driven 3D story (Home → "The problem")

As you scroll, about 60 pieces of real-looking waste fly in and assemble into a globe. The globe then turns from dirty to clean and gets a green glow, and the headline fades in.

| Path | What's in it |
|---|---|
| `src/components/WasteScene/config.ts` | **All the knobs**: piece counts per tier, scroll length, phase timings, easing, camera, colours, glow |
| `src/components/WasteScene/index.ts` | Renderer, camera, HDRI lighting, key/rim lights, floor shadow, render loop, auto-downgrade |
| `src/components/WasteScene/postprocessing.ts` | Depth of field, bloom, film grain and vignette (each can be switched off per tier) |
| `src/components/WasteScene/WasteStory.tsx` | The section: CSS-sticky pin, lazy loading, loader, Lenis, text overlays, fallbacks |
| `src/components/WastePieces/` | GLB loading with meshopt, procedural pieces, instancing, sphere targets, flight curves, dirty→clean shader |
| `src/animation/timeline.ts` | The master GSAP + ScrollTrigger timeline (scrub: 1) |
| `src/hooks/useDeviceTier.ts` | Sorts devices into high / medium / low tiers |

- **Device tiers.** Low-tier devices (weak GPU, ≤2 cores, ≤2 GB RAM, save-data, most phones) get fewer pieces and no post effects or shadow maps. Pixel ratio is capped at 2, or 1.5 on phones.
- **Adaptive quality.** If the frame rate stays under 50 fps, render resolution steps down first, then depth of field is dropped, then all post effects. Resolution steps back up when there's headroom.
- **Scrolling.** Scrolling is native by default, and GSAP `scrub` smooths the animation. Lenis is available but off (`SMOOTH_SCROLL` in `config.ts`): it puts page scrolling on the main thread, which made scrolling stutter whenever the 3D scene was busy.
- **Hero handoff.** The hero fades to the studio black as the 3D section scrolls in, so the two scenes never overlap.
- **Immersive mode.** While the section is pinned, the nav bar slides away (`data-immersive` on `<html>`, styled in `globals.css`). It comes back as soon as you scroll past the section, or when keyboard focus moves into it.
- **Reduced motion.** With `prefers-reduced-motion`, there's no scroll animation, just a still frame of the finished globe.
- **No WebGL.** If WebGL isn't available or the scene fails to load, `public/images/waste-globe.svg` is shown instead.
- **Screen readers.** All the copy is in an `sr-only` block, and the canvas is `aria-hidden`.
- **Payload.** The 3D assets are about 2.1 MB (4 GLBs = 0.58 MB, plus the HDRI = 1.6 MB), and they only load once the section is near the viewport.
- **Assets and licences.** See `CREDITS.md`.

## "How it works" 3D story

This is a second pinned scroll section in the same studio look. It tells the three steps with the app's own data:

1. **Post what you have.** A phone photographs a cluster of glass bottles, there's a flash, the bottles are "captured" into the phone, and the screen goes from viewfinder to listing form to "Your listing is live".
2. **Get found on the map.** The phone flies down and becomes your pin on an extruded 3D Sri Lanka. Listing pins in material colours drop onto the real district centres (from `lib/locations.ts`), and a radar pulse spreads from your pin.
3. **Hand it over.** A collector in Kandy draws a route to you, WhatsApp-style bubbles pop up, and a "Picked up · 18 kg saved" burst follows.
4. **Finale.** The camera pulls back as more handovers light up across the island, with "Zero landfill." and CTAs.

| Path | What's in it |
|---|---|
| `src/components/HowItWorks/config.ts` | Phase timings, camera shots (desktop + mobile), pin counts, colours |
| `src/components/HowItWorks/objects.ts` | Island, pins, route, chat bubbles, phone + screen textures, bottles |
| `src/components/HowItWorks/index.ts` | Scene assembly + per-frame logic |
| `src/components/HowItWorks/HowItWorksStory.tsx` | Pinned section, copy panels, progress rail, static fallback |
| `src/animation/howItWorksTimeline.ts` | The scroll-scrubbed master timeline |
| `src/components/three/stage.ts` | Shared studio (renderer, lights, HDRI, post, adaptive quality, loop) used by both 3D sections |
| `src/hooks/useScrollStory.ts` | Shared hooks: hide nav while pinned, lazy-load near viewport, optional Lenis |

With reduced motion, no WebGL, or a load failure, the section falls back to the plain three-card layout. It adds no downloads of its own: everything is procedural, and the HDRI is shared with the waste scene.

## Deploy (Cloudflare Pages)

`next.config.ts` uses `output: "export"`, so `npm run build` writes a fully static site to `out/`.

- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `out`

`public/_headers` sets long-lived caching for the models, the HDRI and Next's static chunks.

## Notes

- Material colours (`src/lib/materials.ts`) were checked for colour-blind separation in light and dark mode. Keep their order fixed.
- The PWA uses `src/app/manifest.json` and `public/sw.js`. The service worker only registers in production builds (`npm run build`, then serve `out/`).
- OpenStreetMap's public tile server is fine for development. Before launch, switch to a tile provider that allows production traffic.
