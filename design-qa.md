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
4. P2 in published catalog mobile smoke check: a tablet selector overrode the mobile single-column grid, producing letter-by-letter wrapping. Fixed the equally specific mobile `.equipment-grid:not(.selectable)` rule. Recheck evidence: `design/qa/live-mobile-catalog-final.png`.
5. Corrected nested-dialog scroll locking using `body:has(dialog[open])`, avoiding stale body overflow after closing two dialogs.

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

## 2026-09-20: Google 로그인·실시간 서버 연결

- 운영 프로젝트: equipment-loan-yslab-2026, equipment DB, 서울. 실제 billingEnabled=false 조회.
- Auth Google 제공자 활성화. 실제 authorizedDomains 조회에서 Pages 호스트가 빠진 것을 발견하여 등록 후 반환값으로 확인.
- 보안 규칙 테스트에서 최초 신청의 존재 여부 조회가 차단되는 문제를 발견. 인증 사용자에게 없는 문서의 단일 조회만 허용하도록 수정. 다른 사용자의 존재하는 문서는 차단 유지.
- Firebase 에뮬레이터에서 8개 테스트 그룹 통과: 비로그인 조회 차단, 학생별 격리, 관리자 실시간 구독, 중복 ID·신청 간격, 스키마/크기/종류/소유권/상태/시간/수량 변조 차단, 관리자 사칭 차단, 두 승인 중 하나만 성공, 반납 후 재승인, 본인 대기 신청 취소.
- 실제 cloud.js 저장 함수를 테스트에 사용. 서비스용 계정/학생 데이터를 만들어 통과한 것처럼 표시하지 않음.
- 테스트 브라우저에서 별도 에뮬레이터 계정으로 관리자 장비 등록(2개), 학생 3단계 신청, 접수 완료까지 확인.
- PC 표 화면 및 390px 모바일 신청 화면 확인. 글자 깨짐/수평 넘침 없음. 장비 이미지 분류별 대표 이미지라는 문구 표시.
- 운영 Google 계정의 최종 로그인과 실제 서로 다른 물리 기기의 OS 알림은 별도 확인 필요. 에뮬레이터는 Standard 모드이며 운영 Enterprise의 인덱스/권한 배포 성공은 별도로 확인함.
- 재고 변경은 관리자만 가능. 서버 규칙은 학생 공격을 차단하며 관리자는 신뢰된 운영자임. 관리자 자격증명 탈취/의도적 직접 API 재고 수정까지 방어하는 신뢰하지 않는 관리자 모델은 아님.
- 이 규칙은 초기 운영용 검증 기준이며 대규모 공개 전에 사용량·보존·학교 계정 제한·추가 보안 검토 필요.

## 학생 학번·이름 간편 신청

- 학생 Google 로그인과 학년·수업·교수 입력 제거. 학번·이름 입력 후 일정·장비 선택으로 이동. 담당자 Google 로그인 유지.
- 익명 UID로 작성자 권한 유지. 같은 학번을 아는 다른 UID의 조회/승인/장비 조작 차단을 포함한 보안 테스트 9개 그룹 통과. 기존 일반 테스트 16개 통과.
- 에뮬레이터 브라우저에서 Google 로그인 없는 진입부터 신청 접수 완료까지 확인. 신청 요약에 이름·학번만 표시. 390px 모바일 화면 가로 넘침 없음.
- 사용 종료/브라우저 데이터 삭제/다른 기기에서의 이전 내역 조회는 제공하지 않으며 담당자 문의 안내를 표시.
- 실제 Pages 사이트에서도 학번·이름 입력 후 Google 창 없이 진입하여 운영 서버의 '실시간 연결됨'과 빈 장비 목록을 확인. 신청은 제출하지 않아 테스트 신청 정보는 운영 DB에 남기지 않음.
