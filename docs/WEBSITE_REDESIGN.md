# ZeroOne website redesign handover

Branch: `feat/website-redesign`, based on `optimize-finalize`.
Date: 3 October 2026. Deployment and push have not been performed.

## Design and scope

The approved Finovate reference informed the layout, generous spacing, rounded cards, pill buttons, typography and organic six-arm photo cutout. The existing ZeroOne light/dark palettes and admin-configured theme colors remain the source of truth; the reference's lime/forest palette was not adopted following the owner's correction. The licensed source image remains at `docs/design-reference.png.png`, unchanged and untracked.

The homepage includes the hero and information chips, three reusable feature cards, six activities, four benefits, statistics, booking banner, pricing, testimonial and deal cards, offers/guides, session planner, navigation and footer. The accent feature card uses a CSS SVG mask and subtle image/arrow hover animation. Its layout follows the reference while its color follows ZeroOne's existing primary token.

`website/components/redesign/` contains the section components and shared `FeatureCard`, `PillLink`, heading, activity metadata and lightweight intersection-observer reveal. `website/styles/redesign.css` scopes presentation to the new homepage classes. `website/app/page.tsx` assembles the sections and reads public pricing, offers and reviews in parallel.

The existing Navbar/Footer choose the new variants only on the homepage. Other customer routes retain their established layout. Global changes are limited to self-hosted default fonts, a generic original 01 favicon, accessible primary-button contrast, and safe theme initialization. Custom font settings remain supported. Reduced-motion preferences disable both reveal/hover motion and theme transitions. The admin panel, backend, database schema, API implementation and booking wizard were not changed by this redesign.

## Booking and data behavior

- Pricing comes from the existing public pricing API. If unavailable, the owner's supplied rates are displayed with an explicit indicative-pricing notice; booking remains responsible for the authoritative final price.
- Activity links preserve the booking wizard's `activity` query parameter. Deal links preserve `offerId` and URL-encoded `promo` values.
- The Let's Connect/session planner is a GET form to `/book`; it preselects the activity and then uses the existing wizard. It does not create a booking or collect new personal data.
- Active offers and approved public reviews use the existing endpoints. Empty offers show clearly labelled experience guides, not invented promotions or news. Empty reviews show an honest invitation to review.
- Existing authenticated account links, logout, booking-paused state, maintenance/provider behavior, popup handling and theme preferences remain connected to their original contexts.
- The six advertised activities are the owner's requested list. Total booking count is unconfirmed and shown as a dash. Opening hours say "Contact venue for timing". Rating appears only when the reviews API supplies reviews; no fabricated rating or testimonial is displayed.

## Image replacement guide

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

The placeholders total approximately 96 KB before Next.js image processing. All sections use `next/image`, responsive `sizes`, and lazy loading below the hero. The hero requests high fetch priority. `scripts/create-redesign-placeholders.cjs` reproduces the placeholder artwork using the already available Sharp library; it overwrites these eight images, so do not run it after replacing them with real photos unless regeneration is intended.

## Verification

Each homepage section was followed by website build, lint and type-check checks. Final website build and type-check passed. Lint has zero errors and 55 existing warnings; the new redesign components have no warnings. No broad legacy-warning cleanup was mixed into the redesign.

The root unit/security suite passed 26 tests, all-workspace type-check passed, and the existing frontend security smoke checks passed. No production database test, migration, reset or deletion was performed.

The dedicated browser fixture verifies light/dark at 1440 px and 390 px, plus light at 320 px. All five passed with no horizontal overflow, no browser runtime errors and zero automated WCAG A/AA accessibility violations. It also verifies theme persistence and reduced motion, mobile navigation/Escape, the organic hover effect, live and empty offers/reviews, indicative pricing, activity preselection, session-planner navigation, paused bookings, authenticated account links and logout. These are local UI checks using synthetic public API responses; they do not claim to verify a live reservation against production data.

Lighthouse HTML/JSON reports and full-page screenshots are supplied separately with the handover. Scores are measured on a local production build with fixture data and placeholder images, not on the deployed site. Actual photo sizes, hosting latency, custom fonts and live data can affect them. The expected unauthenticated `/auth/me` 401 is reported as a console/network issue by Lighthouse; auth response behavior was retained.

Final Lighthouse run: mobile performance 85, desktop performance 99, accessibility 100, SEO 100 and best practices 96 on both. Mobile LCP was 3.4 seconds and total blocking time 250 ms; desktop LCP was 0.8 seconds and blocking time 60 ms. Both had zero cumulative layout shift. An earlier post-optimization run measured mobile 88/desktop 98; local Lighthouse timings fluctuate, so the delivered reports contain the final run rather than the highest score.

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
