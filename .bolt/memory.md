# Project memory

## Product intent & audience

- **GreenRoots**: a tree-planting community platform focused on environmental impact and community engagement.
- Audience: Indian users involved in or interested in tree planting (gardeners, environmentalists, community organizers, general public).
- Core value: Track and showcase real tree-planting impact through community participation and growth updates.

## Brand personality & voice

- Environmentally conscious, community-oriented, encouraging.
- Impact-focused language: emphasizes collective action and tangible results.
- Indian context-aware (names, locations, species native to India).

## Visual design & UX direction

- Community page surfaces aggregated metrics: trees planted, people involved, locations reached, growth updates count.
- Data visualizations present: Recent Activity feed, Popular Tree Species chart, Top Contributors grid, growth stage breakdown.
- Content is data-driven from live database tables (`trees`, `tree_updates`) — no hardcoded display data.
- Supports growth timeline views per tree with chronological updates.
- Footer present on all pages with consistent structure — now includes creator credit.

## Decisions, constraints & rationale

- Seeded 50 dummy tree registrations with varied Indian names, species, locations, and planting dates (June 2024–October 2025) for initial impact demonstration.
- Added 30 growth updates to older trees for realistic activity feed.
- Decision: all seed data inserted via database, not code — Community page reads live data automatically, so no code changes needed.
- Schema uses two key tables: `trees` (registrations) and `tree_updates` (growth milestones).
- 49 distinct Indian locations used across entries for geographic diversity.
- Multi-page static site: `index.html`, `community.html`, `register.html`, `contact.html`, etc. — no framework.
- Added `package.json` and `vite.config.js` to fix deployment build pipeline; Vite configured for multi-page entry points.
- Scripts use external script references; `type` field added to package.json to clear ESM warnings.
- **Vite moved from `devDependencies` to `dependencies`** — deployment environment only installs production dependencies, so dev deps weren't available during build. This was causing the `command not found: vite` error.
- Build verified working after dependency move.
- **Contact email**: changed from `hello@greenroots.org` to `dixit.manas22@gmail.com` on contact page.
- **Creator credit**: "Created by Manas Dixit" added to footer across all pages (Home, About, Register, Track Growth, Community, Contact).
- Site is ready for publishing via Bolt Cloud (user manually triggers publish).

## Open questions & assumptions

- Whether dummy data should be retained long-term or replaced/migrated as real users join.
- Whether an admin/management interface exists or is planned for managing tree entries and updates.
- Assumed growth stages and update categories based on existing schema — actual taxonomy not yet confirmed.
- Whether user authentication/accounts are part of the platform or if entries are submitted anonymously.
- Whether the contact email should remain personal Gmail or be changed to a domain email later.