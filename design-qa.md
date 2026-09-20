# Design and interaction QA — 2026-09-20

final result: passed

Scope: the clearly labeled browser-local review version. This result is not approval for multi-user production use or a claim of server push delivery.

## Visual truth and captures

User requested refinement of the supplied Stitch designs, not a pixel-exact clone.

- Source PC: `design/source/pc_2/screen.png` (2560 × 1800 pixels).
- Normalized PC source: `design/qa/reference-profile-1440.png` (1440 × 1013).
- Final PC implementation: `design/qa/desktop-profile-final.png`, CSS viewport 1440 × 1000, DPR 1. The in-app browser screenshot output is 1425 × 990, excluding/scaling its scrollbar region. Compared by content regions; small capture-density differences were not treated as layout defects.
- Published PC smoke capture: `design/qa/live-desktop-profile.png`.
- Source mobile equipment: `design/source/_2/screen.png` (780 × 2710, 2x design). Normalize to 390 CSS pixels when reviewing component proportions.
- Mobile implementation: `design/qa/mobile-profile-360.png`, `design/qa/mobile-equipment-360.png` (360 × 800 CSS viewport), `design/qa/mobile-notifications.png` (390 × 844 CSS viewport).
- Additional: `design/qa/desktop-admin.png`, `design/qa/desktop-detail-final.png`.
- The in-app browser's full-page export distorted the mobile composite; those initial full-page captures were rejected for geometry comparison. Viewport captures were used for the profile and equipment checks instead.
- Screenshots and original design exports remain local and are ignored by Git. Only four equipment image assets from the provided export are deployed.

## Comparison and iteration history

1. Compared source PC profile and browser-rendered implementation together in one visual review, including the form and summary region. User-requested refinements: compact the summary, reduce tinted panels, group name and ID on desktop, retain single-column mobile fields, unify Korean naming, replace the fictitious logged-in identity with an explicit demo mode switch.
2. P2: initial secondary text scale was too small in the summary, equipment details, and mobile cards. Raised task text to 14–16px and most secondary information to 12–14px. Increased mobile quantity targets to 44px. Recaptured PC profile, mobile equipment, and notification views.
3. P2: secondary copy remained too pale. Changed secondary copy to `#657186` and main muted text to `#626f82`, retaining blue active states. Recaptured final PC profile and compared it with the normalized source in the same tool response. No unresolved P0/P1/P2 visual issue found in the checked views.
4. Corrected nested-dialog scroll locking using `body:has(dialog[open])`, avoiding stale body overflow after closing two dialogs.

## Required fidelity surfaces

- Typography: self-hosted Noto Sans KR Variable; browser computed font confirmed. Korean input text is editable and readable, no one-character vertical wrapping observed. Labels use explicit associations; field errors and keyboard focus are visible.
- Spacing/layout: source's header, three-step flow, primary form, side summary, management list/detail, and mobile card structure retained. Desktop profile uses 1120px max content width; mobile uses 16–20px outer gutters. At 360px, DOM scroll width was 345px with a 15px scrollbar, not horizontal overflow.
- Colors/tokens: restrained white/gray surfaces, blue primary actions and selection, semantic status badges with text. Secondary text adjusted after review. This is not a full automated WCAG audit.
- Images: four original Stitch equipment images are bundled locally; images remain sharp and use consistent crops. Phosphor library icons replace screenshot glyph text. No fake camera illustration or logo asset was generated.
- Copy: Korean labels unified; redundant English banners removed. Demonstration limitations are stated in the preview strip and settings. No fake academic authentication or email delivery claims.

Focused checks included form labels/values, selected grade, long equipment name, quantity controls, dates, request table cells, notification row, and mobile detail actions. These were readable in viewport captures and DOM inspection.

## Executed functional checks

- Blank profile submission: errors displayed and focus moved to the invalid field.
- Fill five profile fields; three-step navigation retains values.
- Switch to off-campus use; location/reason labels update.
- Select camera/lens; submit after checking the non-binding guidance checkbox; success dialog appears.
- Admin sees the request and an unread notification; notification opens the matching detail and becomes read.
- Approve request; student unread notification appears.
- Mobile 360px: submit a second request with two lights; reject requires a nonempty reason; rejected status recorded.
- Mark approved equipment handed over, then returned; counters and status filter reflect transitions.
- Reload: requests, statuses and draft remain stored.
- Browser console error/warning logs: empty in checked local and published sessions.
- Automated suite: 16 passing tests (12 reservation/workflow tests + 4 starter packaging/worker tests).
- GitHub Actions initial build/test/deployment succeeded; published page rendered at the actual GitHub Pages URL.

## Boundaries and follow-up

- No email integration (explicit user preference).
- No cross-device database, real student/admin authentication, server role enforcement, scheduled reminders, or background push sender in this iteration.
- Browser notification settings and service-worker display/click plumbing implemented. A permission request was exercised in the in-app browser, but OS-level notification delivery was not independently verified; do not present it as tested end-to-end.
- Responsive testing used browser viewport overrides, not physical iPhone/Android hardware. Software keyboard behavior remains a real-device follow-up.
- CSV export is implemented; no spreadsheet application import was manually tested.

## Implementation checklist

- [x] Source-based visual refinement and self-hosted Korean font.
- [x] Working application and management workflow.
- [x] Local notifications and honest demo boundary.
- [x] Reservation/state tests and browser interaction checks.
- [x] PC/mobile viewport checks and final visual review.
- [x] GitHub repository and Pages deployment.
