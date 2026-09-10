# Mazora daylight world — design and implementation plan

Prepared 8 September 2026. Implemented 9 September 2026 after approval. The original audit and proposal below are retained as design context; see [implementation notes](implementation.md) for delivered assets and validation.

## Recommended direction

Make light mode feel like morning in the same Mazora world. Preserve the Minecraft geometry, floating islands, amethyst crystals, bridges, violet brand, logo, typography, and page structure. Give light mode its own daylight artwork, with lavender sky, sunlit pale stone, muted green foliage, and soft atmospheric depth.

The website is both a cinematic entrance to a Minecraft community and a working platform: joining the server, reading announcements, exploring worlds and players, shopping, voting, seeking support, and managing accounts. Rich landscapes suit the entrance and discovery pages. Reading, shopping, forms, and administration need calmer, reliably opaque surfaces.

Keep the existing light palette as the starting point: base `#F7F5FB`, surface `#F0EDF8`, white cards, ink `#1E172B`, muted text `#5B516C`, violet `#7C3AED`, and deeper violet `#6520CD` for readable accents. Daylight should retain textured terrain and violet identity rather than becoming a white wash.

## What was reviewed

- Project README, route/layout structure, theme provider and pre-paint theme script, shared header/footer, homepage composition, background asset inventory, and relevant global/Store/Vote/News styles.
- Local homepage visually inspected in light and dark mode at desktop size, including the dark News, map, community, and footer transitions.
- Dark homepage hero-to-news and footer inspected at a 390 × 844 viewport. Desktop viewport restored afterward.
- Store, Vote, News, account, authentication, and status/error styling were reviewed at source level. Their full rendered route matrices remain implementation QA work. Store browser navigation timed out during this review; no visual verdict is claimed for that route.
- No automated application tests were run for this documentation and concept-only change.

## Current findings

| Area | Evidence and implication |
| --- | --- |
| Theme foundation | `src/components/theme/theme-provider.tsx` already persists `mz-theme` and sets `data-theme` before paint. Extend this mechanism for artwork; avoid introducing a second theme state. |
| Shared world | `src/styles/globals.css` gives `.site-world-frame::before` the same dark continuation image in both themes, with different overlays. `.site-world-main` and many headings explicitly use white. Swapping the image alone would harm readability. |
| Home hero | `src/app/(home)/page.tsx` uses `mazora-community-hero.webp`, including an explicit responsive preload. Both the displayed asset and preload strategy must become theme-aware together. |
| Home blend | `.hero-art` fades over the last 28% of its height; `.home-world` overlaps by 8rem. Visually, there is no sharp horizontal seam, but a broad dark band and the change to a different landscape remain perceptible. |
| Lower Home | News → map → community share one world and look continuous on the inspected desktop viewport. The footer continues that world with a gradual darkening. Preserve this structure. |
| Mobile Home | The hero transition and footer have no obvious sharp seam in the inspected views. A narrow central crop removes much of the architecture, so mobile art direction deserves a separate pass. |
| Store | `store-header.css` and `globals.css` contain independent hero, marketplace, frame, and footer backgrounds. Light mode explicitly retains dark marketplace artwork and dark transitions. Multiple world layers create a maintenance risk; a visible seam is not established by source alone. |
| Vote | `vote.css` uses `vote-sanctuary-hero-v6.webp` through the page component and `vote-sanctuary-continuation-v11.webp` for the continuation. Several light overrides remove masks and retain a dark world. Older vote-world revisions also remain in global CSS. Trace final matching selectors before replacing rules. |
| News | The route imports several successive design stylesheets. `newsroom-responsive.css` repaints continuation art in the page and footer with different crops and a masked overlap. These can shift relative to one another with page length. |
| Global details | The root background and scrollbar track are hardcoded dark. Loading/error artwork, auth art columns, public headings, dashboard backgrounds, and translucent controls also need a daylight pass. |

## Generated concepts available now

1. **Daylight hero v1** — `concepts/mazora-daylight-hero-v1.png`. Generated from the existing Home hero as an edit reference, retaining its floating islands, side castles, waterfalls, bridges, central portal and valley. Morning lighting and lavender foreground mist replace the night treatment.
2. **Daylight valley v1** — `concepts/mazora-daylight-valley-v1.png`. Generated from the current shared continuation scene, using the new daylight hero as a lighting reference. Intended for the lower Home, shared public world, and footer.

These are review masters, not optimized production assets. Their matching atmosphere does not guarantee pixel-perfect continuity. Test the actual crop and overlap in the page before selecting final versions. The hero still has a bright center; position the existing logo and controls over it during review to check their edges and contrast.

## Complete artwork set

Use one consistent generation recipe: preserve each existing scene's recognizable structure; match the daylight hero's palette and light direction; keep the content region quiet; retain cubic material texture; omit all text, logos, interfaces, and watermarks. Generate each scene separately and use the approved daylight master as its style reference.

| Asset | Planned scene and use | Status |
| --- | --- | --- |
| Home hero | Morning amethyst kingdom; floating islands and architecture frame the existing logo/stat layout | Concept generated |
| Shared continuation | Misty river valley and pale bridges, calmer than hero; lower Home and general public pages through footer | Concept generated |
| Store hero | Daylit counterpart of `store/shop-world-bg-v2.webp`; preserve the current commerce-world setting | Planned |
| Store continuation | Daylit `store/shop-marketplace-bg.webp`; quieter center behind product listings, continuous through product pages/footer | Planned |
| Vote hero | Sunlit counterpart of `vote-sanctuary-hero-v6.webp`; violet sanctuary identity and recognizable structure | Planned |
| Vote continuation | Match `vote-sanctuary-continuation-v11.webp` in daylight; aligned path/architecture and mist at the hero join | Planned |
| News world | Daylight adaptation of the current signal-realm hero and header continuation; consistent architecture across archive/article/footer | Planned pair |
| Map fallback | Optional daylight counterpart of `mazora-live-map-preview-v1.webp`; preserve its role as a decorative offline preview | Planned |
| Mobile variants | Art-directed crops of the chosen masters; generate portrait companions only where cropping loses necessary landmarks | After desktop selection |

Reuse the shared valley for Support, Play, Rules, Gallery, Staff, Events, player discovery, legal pages, and suitable launch/status views. Give each page a local readability treatment. Auth, account, and admin can reuse a subtle crop instead of requiring separate large images. Keep actual player screenshots, news content images, and product artwork as content; their colors need not change with the UI theme. A live map iframe needs its own supported theme mechanism, if available.

## Section continuity contract

The intended Home flow is: daylight kingdom → overlapping lavender mist → shared valley behind News → the same valley behind Map → the same valley behind Community → a slightly quieter valley behind the footer. Dark mode keeps its twilight equivalent.

Make the route frame own the body artwork through the footer. Let sections remain transparent outside their cards. The footer adds only a theme-specific readability gradient; it should not restart the scene. Where hero and body use different art, overlap actual artwork with a responsive mask, and align their lighting, horizon tone, and scale before tuning opacity. Use a bounded blend distance as a starting point, then verify at short and tall viewport heights rather than assuming a fixed percentage works everywhere.

For News, Store, and Vote, first identify the effective background owners and remove only proven superseded rules in that scope. Avoid appending another final override to solve each seam. Keep old assets until all references are checked. Tune dark mode and light mode independently using the same structural rules.

Dark-mode priorities are the Home hero's broad dark transition, Store hero/catalog/footer ownership, Vote hero/body overlap under varying content height, and News archive/footer image alignment. The lower Home and footer already look continuous in the inspected desktop view and should serve as the baseline.

## Implementation phases

1. **Establish baseline and choose art.** Record both themes on Home, Store, Vote, News, and a shared public route. Compare the two concepts under the real logo, navigation, stats, news cards, and footer. Confirm the morning palette and adjust image composition where needed.
2. **Build Home as the complete pilot.** Add paired light/dark artwork roles, overlay colors, world text colors, focal positions, and seam colors. Keep the existing `data-theme` mechanism. Update hero asset selection and preload together, shared frame, homepage headings/stats/buttons, footer, scrollbar and page background. Preserve opaque reading cards. Scope the pilot so routes using the shared frame do not receive bright backgrounds before their text has been adapted.
3. **Extend public pages and states.** Apply the shared valley to general public routes with dark ink and readable controls in light mode. Adapt authentication art, account/admin world surfaces, loading screens, errors, and launch/status views. Keep tables and forms on opaque panels.
4. **Generate and integrate the specialist worlds.** Produce Store, Vote, and News pairs from their current references. Consolidate their background rules route by route, preserving stylesheet import behavior until the replacements are verified. Carry each continuation through its footer; test long/short listings and empty states.
5. **Optimize and verify.** Export selected masters as responsive WebP/AVIF where the existing pipeline supports them. Use responsive hero sources, sensible quality settings, and a selected-theme preload strategy. Confirm the network does not eagerly download both full-resolution worlds. Check first visit, saved choice, reload, theme toggle, and client navigation for incorrect flashes or persistent route overrides.

CSS artwork can be selected through variables under `[data-theme]`; responsive hero image selection needs an explicit implementation decision that respects the saved user choice as well as system preference. A `prefers-color-scheme` picture source by itself would ignore a saved manual override. Avoid solving that with two eagerly loaded hidden hero images. If JavaScript selects the source, ensure it does not create a dark first-paint flash or break the existing responsive preload.

## Acceptance checks

- Inspect desktop at 1440 × 900 and 1920 × 1080, short desktop at 1366 × 768, tablet at 768 × 1024, and mobile at 390 × 844 and 360 × 800.
- Scroll slowly across every hero/body, section/section, and body/footer boundary in both themes. No hard line, repeated horizon, black strip in daylight, exposed canvas, or sudden shift in image scale.
- Check long pages, empty states, News pagination, Store categories/product detail, Vote listings, and client navigation among them. Content length must not stretch the world into an unrecognizable crop.
- Check text, metadata, buttons, navigation, chips, tables, forms, disabled states, hover/focus, dropdowns, mobile menus, account panels, cart and auth dialogs over their actual background. Aim for 4.5:1 normal text and 3:1 large text/UI boundaries as applicable.
- Test saved light and dark preference, first visit with each system preference, reload, and theme toggling near the footer. No incorrect artwork flash. Ensure contrast remains stable during any transition.
- Keep reduced motion support. Do not add parallax or make the entire layout animate on theme change. Reconsider fixed backgrounds on mobile if cropping or scroll performance suffers.
- Verify image requests and layout stability; artwork should not move content or delay the current hero unnecessarily. After application changes, run the repository's lint, typecheck, unit tests, and production build.

Recommended first implementation milestone: finish Home in both themes, including navigation, News, map fallback treatment, community section, footer, mobile crops, and loading transition. Use that proven visual system to guide the remaining route families.
