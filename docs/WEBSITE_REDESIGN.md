# ZeroOne website redesign handover

Branch: `feat/website-redesign`, based on `optimize-finalize`.
Date: 3 October 2026. Deployment and push have not been performed.

## Owner review updates

The hero now spans almost the full viewport width with a 12 px desktop gutter and a viewport-height minimum. Navigation floats over it, with a separate 1320 px maximum width, 64 px desktop height and 116 px logo (rebalanced after owner review). On mobile, the header remains 60 px high for touch targets and the hero can grow to fit its copy/chips. Other content containers remain 1240 px. Motion now includes a short hero text/chip entrance sequence, section-local staggered reveals and a small, clamped scroll drift for the hero/banner photos. Native scrolling is retained; passive listeners schedule DOM updates through requestAnimationFrame without React scroll-state renders. Motion follows system reduced-motion by default. The Enable/Pause animations control stores an explicit per-site preference under zeroone-motion; opting in enables website motion even when the system preference reduces motion, without changing OS settings. Pausing or an unoverridden system preference exposes content immediately. Keyboard focus exposes any pending reveal.

The header uses the existing `glass-nav` utility and `--theme-glass-*` tokens, so the existing admin Appearance glass setting controls transparency/blur/shadow independently in light and dark modes; no new admin toggle was added.

All homepage illustration slots now use existing ZeroOne venue photographs from `website/public/images/`. The pricing illustration is replaced by a rounded snooker photograph with a readable caption. The latest owner choice replaces pricing/review metrics with 24/7 availability and Player visits. Visits use the new read-only public aggregate of COMPLETED bookings, including completed walk-ins; each completed session counts, including repeat visits. It does not estimate the number of people accompanying a booking. Values use compact K/M formatting without rounding upward. Unavailable data shows an unavailable state rather than a fabricated zero.

## Design and scope

The approved Finovate reference informed the layout, generous spacing, rounded cards, pill buttons, typography and organic six-arm photo cutout. The existing ZeroOne light/dark palettes and admin-configured theme colors remain the source of truth; the reference's lime/forest palette was not adopted following the owner's correction. The licensed source image remains at `docs/design-reference.png.png`, unchanged and untracked.

The homepage includes the hero and information chips, three reusable feature cards, six activities, four benefits, statistics, booking banner, pricing, testimonial and deal cards, offers/guides, session planner, navigation and footer. The accent feature card uses a CSS SVG mask and subtle image/arrow hover animation. Its layout follows the reference while its color follows ZeroOne's existing primary token.

`website/components/redesign/` contains the section components and shared `FeatureCard`, `PillLink`, heading, activity metadata and lightweight intersection-observer reveal. `website/styles/redesign.css` scopes presentation to the new homepage classes. `website/app/page.tsx` assembles the sections and reads public pricing, offers and reviews in parallel.

The existing Navbar/Footer choose the new variants only on the homepage. Other customer routes retain their established layout. Global changes are limited to self-hosted default fonts, a generic original 01 favicon, accessible primary-button contrast, and safe theme initialization. Custom font settings remain supported. Reduced-motion preferences disable both reveal/hover motion and theme transitions. The admin panel, database schema and booking wizard remain unchanged. The latest visits feature adds only the read-only /api/public-stats aggregate and a 10-second public cache entry; existing API contracts and billing/booking mutations remain unchanged.

## Booking and data behavior

- Pricing comes from the existing public pricing API. If unavailable, the owner's supplied rates are displayed with an explicit indicative-pricing notice; booking remains responsible for the authoritative final price.
- Activity links preserve the booking wizard's `activity` query parameter. Deal links preserve `offerId` and URL-encoded `promo` values.
- The Let's Connect/session planner is a GET form to `/book`; it preselects the activity and then uses the existing wizard. It does not create a booking or collect new personal data.
- Active offers and approved public reviews use the existing endpoints. Empty offers show clearly labelled experience guides, not invented promotions or news. Empty reviews show an honest invitation to review.
- Existing authenticated account links, logout, booking-paused state, maintenance/provider behavior, popup handling and theme preferences remain connected to their original contexts.
- The six advertised activities are the owner's requested list. The unconfirmed total booking count is omitted in favor of live snooker pricing. Opening hours display "Open 24/7", confirmed by the owner. Rating appears only when the reviews API supplies reviews; no fabricated rating or testimonial is displayed.

## Current venue photos

| Existing source file under `website/public/images/` | Original dimensions | Placement |
| --- | --- | --- |
| `Snokker/snooker-table.jpg (3).webp` | Existing original venue photo | Brighter fullscreen hero and booking banner |
| `Snokker/snooker-table.jpg.webp` | 765 × 1020 | Snooker activity, feature, pricing photo and experience guide |
| `PS5/ps5-room.jpg.webp` | 1280 × 960 | Open console activity, accent deal cards and offer guide |
| `Cinema/cinema.jpg.webp` | 1280 × 960 | Cinema activity, feature, review background and guide |
| `priveat ps5.webp` | 766 × 1020 | Private console activity |
| `Table tennis/tablle tennis.webp` | 765 × 1020 | Table tennis activity |
| `Car simulater/car-simulator.jpg.webp` | 1360 × 611 | Simulator activity |

Existing photographs are served through `next/image`; original files and uploads are unchanged. Payment receipts and customer/staff uploads were not used. New venue photography can replace these files with attention to focal position and responsive cropping.

## Original placeholder archive (not used by the current homepage)

All eight files under `website/public/images/redesign/` are original, labelled gaming illustrations used as placeholders, not venue photographs. They contain no reference people or third-party logos. Replace the files with approved venue photography at the same paths, retain the aspect ratio, and keep the important subject near the center to accommodate responsive cropping and the feature-card mask. Update alt text to describe each real photo when replacing it.

| File | Dimensions / ratio | Photo needed and placement |
| --- | --- | --- |
| `hero-venue.webp` | 1920 × 1080 / 16:9 | Wide venue interior; hero and large booking banner. Keep text area visually quiet. |
| `current-deal.webp` | 1200 × 1200 / 1:1 | Current offer's gaming setup; accent feature/deal cards. Center subject within the cutout. |
| `snooker.webp` | 900 × 1125 / 4:5 | Snooker table; feature card, activities and fallback experience guide. |
| `ps5-gaming.webp` | 900 × 1125 / 4:5 | Open console gaming setup; activity card. |
| `private-cinema.webp` | 900 × 1125 / 4:5 | Private cinema interior; feature, activity and experience-guide cards. |
| `private-ps5-room.webp` | 900 × 1125 / 4:5 | Private console room; activity card. |
| `table-tennis.webp` | 900 × 1125 / 4:5 | Table tennis room; activity card. |
| `car-simulator.webp` | 900 × 1125 / 4:5 | Simulator cockpit; activity card. |

The placeholders total approximately 96 KB before Next.js image processing. The current photo sections use `next/image`, responsive `sizes`, and lazy loading below the hero. The hero requests high fetch priority. `scripts/create-redesign-placeholders.cjs` reproduces the placeholder artwork using the already available Sharp library; it overwrites these eight images, so do not run it after replacing them with real photos unless regeneration is intended.

## Verification

Each homepage section was followed by website build, lint and type-check checks. Final website build and type-check passed. Lint has zero errors and 55 existing warnings; the new redesign components have no warnings. No broad legacy-warning cleanup was mixed into the redesign.

The root unit/security suite passed 26 tests, all-workspace type-check passed, and the existing frontend security smoke checks passed. No production database test, migration, reset or deletion was performed.

The dedicated browser fixture verifies light/dark at 1440 px and 390 px, plus light at 320 px. All five passed with no horizontal overflow, no browser runtime errors and zero automated WCAG A/AA accessibility violations. It also verifies theme persistence and reduced motion, mobile navigation/Escape, the organic hover effect, live and empty offers/reviews, indicative pricing, activity preselection, session-planner navigation, paused bookings, authenticated account links and logout. These are local UI checks using synthetic public API responses; they do not claim to verify a live reservation against production data.

Lighthouse HTML/JSON reports and full-page screenshots are supplied separately with the handover. Scores are measured on a local production build with fixture data and placeholder images, not on the deployed site. Actual photo sizes, hosting latency, custom fonts and live data can affect them. The expected unauthenticated `/auth/me` 401 is reported as a console/network issue by Lighthouse; auth response behavior was retained.

Lighthouse run before the owner photo/fullscreen revisions (historical): mobile performance 85, desktop performance 99, accessibility 100, SEO 100 and best practices 96 on both. Mobile LCP was 3.4 seconds and total blocking time 250 ms; desktop LCP was 0.8 seconds and blocking time 60 ms. Both had zero cumulative layout shift. An earlier post-optimization run measured mobile 88/desktop 98; local Lighthouse timings fluctuate, so the delivered reports contain the final run rather than the highest score.

Run standard checks from the repository root:

```powershell
npm run build:website
npm run lint --workspace=website
npm run typecheck --workspace=website
npm run typecheck
npm test
npm run test:frontends
```

Optional browser checks use externally installed Playwright and `@axe-core/playwright`, keeping QA dependencies out of production packages. Configure their local module paths, a local Chrome binary, and an output directory:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = '<path-to-playwright-module>'
$env:AXE_MODULE_PATH = '<path-to-@axe-core/playwright-module>'
$env:CHROME_PATH = '<path-to-chrome.exe>'
$env:REDESIGN_QA_OUTPUT = '<existing-local-output-directory>'
node scripts/check-redesign.cjs

$env:LIGHTHOUSE_CLI = '<path-to-lighthouse/cli/index.js>'
node scripts/audit-redesign.cjs
```

Both scripts start and close a task-owned localhost API fixture and the built customer website on port 4322. They do not start the backend or access a database. The production website build must exist first, and port 4322 must be free. To inspect the same synthetic preview manually, run `node scripts/redesign-fixture.cjs` and stop it with Ctrl+C when finished. The test-only fixture must never be used for deployment.

## Delivery constraints

No deployment was authorized. Push requires the owner's approval after reviewing git status and the diff summary. The branch inherits the earlier optimization commits; its redesign-only diff is against `optimize-finalize`. The licensed reference is retained outside commits, and no environment values, credentials, QA tool installations or database files are added to Git.

Owner revision checks: website build/type-check passed, lint zero errors with the same 55 warnings. Browser regression checks include requested desktop header/logo geometry, fullscreen hero, real photo sources, real price/review metrics, and glass on/off behavior in addition to existing responsive and booking/account checks.

## Visits and animation follow-up

The actual owner browser reported prefers-reduced-motion: reduce, which explained the invisible motion. The new per-site Enable/Pause control respects that default while supporting explicit opt-in. Motion preference and live system preference changes are regression-tested. A missed Connect image path was corrected and all homepage photo loads are now checked.

The visit aggregate exposes only totalPlayerVisits. It uses the existing indexed booking status and includes repeat COMPLETED session records; groups count per completed resource session, since physical party headcounts are not recorded. Historical/offline visits absent from the system are not invented. API failure returns 503 without database details. The count is cached for 10 seconds and successful mutations invalidate it. Tests inject the count dependency and never query a real DB; 29 unit/security tests passed. The local fixture uses zero visits by default and 2500 in the labelled live test scenario to verify 2.5K formatting, not production business figures.

## Customer website consistency — 3 October 2026

Reference reviewed: https://finovate.vamtam.com/ (owner-licensed reference). The website adapts its spacious split introductions, large photography, numbered editorial rows, pill actions and FAQ treatment to ZeroOne's existing purple light/dark palette. Reference people photos, finance content and logos are not used.

- All customer routes now use the shared navigation and footer. Active-page links follow the route; mobile navigation closes on route changes. Appearance-controlled glass remains in place.
- `PageIntro` supplies consistent photography and page headings for Activities, About, Gallery, Reviews, Location and Contact.
- About uses real venue photography, numbered experience points, a native expandable FAQ and the existing booking banner.
- Login, signup and password recovery share a split photo/form layout on desktop and a focused form on mobile. Theme-aware logos replace legacy media-query logos.
- Booking, review submission, profile and my-bookings share the homepage typography, containers, rounded panels, focus states and action styling. Existing event handlers, pricing and booking requests remain unchanged.
- FeatureCard's former organic cutout is replaced by a bold, font-independent SVG `01` photo mask, including on the offer card. Real venue images remain optimized with next/image.
- Gallery prefers the existing public gallery API. If no images are published or its existing API helper returns an empty fallback, it displays the six bundled venue photographs. Cards are keyboard-operable buttons and preserve the existing category and lightbox behavior.
- The same persistent animation preference applies across routes. Marketing introductions/sections reveal subtly; forms remain stable and usable. Reduced-motion preference remains the default unless the visitor explicitly enables animation.
- Corrected visible legacy Unicode corruption, small-text contrast, the Contact Subject accessible name and the missing-token reset page heading found during visual/accessibility checks.

Responsive decisions: content stays at 1240px with mobile gutters; marketing image/text introductions stack below 850px. Authentication photo panels are hidden below 850px, keeping the form foremost. Existing navigation stays at 1320px maximum and uses the prior mobile breakpoint.

Verification uses `scripts/check-customer-pages.cjs` with the same optional Playwright, axe and Chrome environment variables as `scripts/check-redesign.cjs`. It covers all 14 customer routes in desktop light, mobile dark and 320px light, including active navigation, overflow, runtime errors, accessibility, booking entry, gallery keyboard opening, logo theme and text encoding. All API responses are local in-memory fixtures; no real database is used. The fixture's empty account-booking response exists only for these tests.

No admin changes, migrations, database resets, file cleanup, deployment or push are included.

### Solid color and account avatar follow-up

All website gradient fills have been removed at their source: primary buttons, selected booking states, decorative panels, text fills, receipt accents, image shades and glass pattern. Photo readability uses a uniform translucent shade; Appearance still controls glass blur. Primary actions use the existing theme primary color and its contrast token. Status colors remain semantic.

The desktop header uses a circular account icon for signed-out users and logged-in users without a photo. When a customer has a profile picture it appears in that control; failed image loads fall back to the icon. Accessible names remain Sign In / Account, and the existing profile, bookings and sign-out menu remains available. Mobile retains the existing navigation menu and account links.

Regression checks assert flat rendered backgrounds across customer routes and cover profile-photo success, absent-photo and failed-photo fallback without a real account or database.
