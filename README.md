# 기자재 대여·반출

Stitch 시안을 바탕으로 만든 한국어 PC·모바일 반응형 대여 웹입니다.

- 사이트: https://yunseonglab-droid.github.io/equipment-loan/
- Google 로그인, 학생 본인 신청 조회, 담당자 승인·반려·인도·반납·승인 취소
- 학번·이름·학년·수업·교수·목적·장소·일정 입력, 최대 4종 / 30일 / 90일 이내 시작
- 실제 장비 등록·수정, 일정별 수량 확인, CSV 내보내기
- 서로 다른 기기 간 Firestore 실시간 동기화, 웹 알림함 / 모두 읽음
- 지원 브라우저에서 권한을 허용하면 웹이 열려 있는 동안 시스템 알림 표시

## 운영 설정

Firebase 전용 프로젝트 `equipment-loan-yslab-2026`, Firestore Enterprise Native `equipment`, 서울 `asia-northeast3`를 사용합니다. Google 제공자에서 인증된 `yunseonglab@gmail.com`만 관리자입니다. 화면의 메뉴 전환과 별도로 Firestore 규칙에서 권한을 검증합니다. 공개 SDK 설정은 비밀 키가 아닙니다. 서버 자격증명을 프런트엔드에 넣지 않습니다.

결제 계정을 연결하지 않았으며, 유료 서버 함수·메일·웹 종료 후 푸시는 구현하지 않았습니다. 무료 할당량 초과 시 제한될 수 있습니다. 브라우저/운영체제의 백그라운드 탭 정지에 따라 시스템 알림이 늦을 수 있습니다.

처음 운영할 때 관리자로 로그인하여 **기자재 → 기자재 등록**에서 실제 보유 장비와 수량을 입력합니다. 운영 데이터베이스에는 예시 데이터를 넣지 않습니다. 사진은 분류별 대표 이미지입니다. 학생이 직접 입력한 학번은 학교 재학 여부를 인증하는 수단이 아닙니다. 현재 Google 계정 로그인에는 학교 도메인 제한이 없습니다.

승인 대기 신청은 재고를 예약하지 않습니다. 담당자가 승인할 때 실제 수량을 다시 읽고 공통 일정 문서를 포함하는 트랜잭션으로 예약합니다. 동시 승인은 충돌 시 재시도합니다. 인도 시 실제 인도 시점부터 점유하고, 반납 전 연체된 장비는 계속 차감합니다. 승인된 신청의 취소는 담당자가 처리합니다. 예약 중인 장비 수정은 차단합니다.

실시간 알림이 필수여서 Firestore pipeline 대신 `onSnapshot` 쿼리를 사용합니다. 학생은 최근 본인 신청 100건, 관리자는 최근 100건과 진행 중 최대 300건을 함께 구독합니다. 장비 목록은 최대 100종, 예약 일정은 최대 300건을 대상으로 한 초기 운영 범위입니다. 장기 운영 시 페이지별 조회/보존 정책과 사용량을 검토해야 합니다. 공용 일정에는 이름·학번·계정 ID를 저장하지 않습니다. 신청 개인 정보는 본인과 관리자만 읽습니다.

## 개발 및 검증

Node.js 22+, 보안 테스트용 Java 21+:

```sh
cd web
npm ci
npm run dev
npm run build
npm test
```

루트에서 보안·실시간·동시성 테스트:

```sh
npx -y firebase-tools@latest emulators:exec --only firestore --project demo-equipment-loan "npm run test:rules --prefix web"
```

실제 Google 계정 없이 화면을 점검하려면 Auth/Firestore 에뮬레이터와 `VITE_EMULATORS=true` Vite 개발 서버를 실행합니다. 개발 화면에만 테스트 계정 버튼이 나타납니다. 운영 빌드에서는 이 경로가 꺼지며, 운영 권한 규칙도 테스트 계정을 허용하지 않습니다. 과거 localStorage 데모의 순수 함수 회귀 테스트는 유지하지만 운영 앱은 해당 저장소를 사용하지 않습니다. 작성 중 신청서는 메모리에만 유지하며 로그아웃하면 지워집니다.

## 배포

`main` push 시 GitHub Actions가 빌드, 일반 테스트, Firebase 에뮬레이터 테스트 후 Pages에 배포합니다. Firebase 규칙/인덱스는 별도로 배포합니다:

```sh
npx -y firebase-tools@latest deploy --only firestore,auth --project equipment-loan-yslab-2026
```

Google 로그인 허용 도메인은 Firebase Authentication 설정에서 실제 값을 확인해야 합니다. 현재 GitHub Pages 호스트와 Firebase 기본 도메인, localhost를 등록했습니다. 프런트엔드 배포만으로 백엔드 규칙은 바뀌지 않습니다.

## 주요 파일

- `web/src/App.jsx`, `web/src/styles.css`: 화면과 사용자 흐름
- `web/src/cloud.js`: 로그인, 실시간 구독, 서버 저장 트랜잭션
- `web/src/domain.js`: 입력 검증과 시간대별 최대 수량 계산
- `firestore.rules`, `firestore.indexes.json`: 서버 접근 제어와 쿼리 인덱스
- `web/tests/integration/firestore.test.mjs`: 별도 계정 접근·잘못된 입력·동시 승인·실시간 전달 검증
- `web/public/sw.js`: 브라우저 알림 표시/클릭 처리

글꼴: Noto Sans KR Variable (SIL OFL). 아이콘: Phosphor (MIT). 기자재 대표 이미지 4개는 사용자 제공 Stitch 시안에서 추출했습니다. 원본 ZIP과 테스트 화면/개인정보는 저장소에 포함하지 않습니다.
