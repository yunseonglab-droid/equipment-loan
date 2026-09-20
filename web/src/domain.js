export const CATALOG = [
  {
    id: "fx3",
    name: "Sony FX3",
    subtitle: "Cinema Line · 풀프레임 시네마 카메라",
    category: "카메라",
    total: 3,
    image: "fx3.png",
  },
  {
    id: "lens",
    name: "FE 24–70mm F2.8 GM II",
    subtitle: "Sony · 표준 줌 렌즈",
    category: "렌즈",
    total: 4,
    image: "lens.png",
  },
  {
    id: "light",
    name: "Aputure 300d II",
    subtitle: "LED 조명 · 스탠드 포함",
    category: "조명",
    total: 4,
    image: "light.png",
  },
  {
    id: "mic",
    name: "DJI Mic 2",
    subtitle: "무선 마이크 · 송신기 2개 세트",
    category: "오디오",
    total: 2,
    image: "mic.png",
  },
];
export const STATUSES = {
  pending: "승인 대기",
  approved: "승인 완료",
  borrowed: "대여 중",
  returned: "반납 완료",
  rejected: "반려",
  cancelled: "취소",
};
export const STORE_KEY = "equipment-loan:v1";
export const DRAFT_KEY = "equipment-loan:draft:v1";
export const ACTIVE = ["pending", "approved", "borrowed"];
export function dateInput(offset = 0, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function freshDraft() {
  return {
    studentId: "",
    name: "",
    year: "",
    course: "",
    professor: "",
    start: dateInput(1),
    end: dateInput(3, 17),
    use: "inside",
    location: "",
    purpose: "",
    items: [],
    agreed: false,
  };
}
export function initialState() {
  return {
    version: 1,
    requests: [],
    notifications: [],
    notificationEnabled: false,
  };
}
export function equipment(id) {
  return CATALOG.find((x) => x.id === id);
}
export function itemTitle(items) {
  return items.length
    ? `${equipment(items[0].id)?.name || "기자재"}${items.length > 1 ? ` 외 ${items.length - 1}종` : ""}`
    : "선택한 기자재 없음";
}
export function formatDate(value, withTime = true) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "일정 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(d);
}
export function isOverdue(r, now = Date.now()) {
  return r.status === "borrowed" && new Date(r.end).getTime() < now;
}
export function statusLabel(r) {
  return isOverdue(r) ? "연체" : STATUSES[r.status];
}
export function available(id, start, end, requests, excludeId) {
  const item = equipment(id);
  if (!item) return 0;
  const from = Date.parse(start),
    to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from)
    return item.total;
  // Half-open intervals; use peak simultaneous usage instead of summing disjoint bookings.
  const events = [];
  for (const r of requests) {
    if (r.id === excludeId || !ACTIVE.includes(r.status)) continue;
    const qty = r.items.find((i) => i.id === id)?.qty || 0;
    if (!qty) continue;
    const s = Math.max(from, Date.parse(r.start));
    const e = Math.min(to, isOverdue(r) ? Infinity : Date.parse(r.end));
    if (s < e) {
      events.push([s, qty], [e, -qty]);
    }
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let used = 0,
    peak = 0;
  for (const [, delta] of events) {
    used += delta;
    peak = Math.max(peak, used);
  }
  return Math.max(0, item.total - peak);
}
export function validateProfile(d) {
  const e = {};
  if (!/^\d{6,12}$/.test(d.studentId.trim()))
    e.studentId = "학번을 숫자 6~12자리로 입력해 주세요.";
  if (!d.name.trim()) e.name = "이름을 입력해 주세요.";
  if (!d.year) e.year = "학년을 선택해 주세요.";
  if (!d.course.trim()) e.course = "수업명을 입력해 주세요.";
  if (!d.professor.trim()) e.professor = "담당 교수님 성함을 입력해 주세요.";
  return e;
}
export function validateBooking(d, requests, now = Date.now()) {
  const e = {};
  const s = Date.parse(d.start),
    t = Date.parse(d.end);
  if (!Number.isFinite(s) || s < now)
    e.start = "현재 이후의 대여 일시를 선택해 주세요.";
  if (!Number.isFinite(t) || t <= s)
    e.end = "반납 일시는 대여 일시보다 늦어야 해요.";
  if (!d.location.trim())
    e.location =
      d.use === "outside"
        ? "반출 장소를 입력해 주세요."
        : "사용 장소를 입력해 주세요.";
  if (!d.purpose.trim()) e.purpose = "사용 목적을 입력해 주세요.";
  if (!d.items.length) e.items = "기자재를 한 종류 이상 선택해 주세요.";
  const ids = new Set();
  for (const i of d.items) {
    if (
      ids.has(i.id) ||
      !equipment(i.id) ||
      !Number.isInteger(i.qty) ||
      i.qty < 1
    ) {
      e.items = "선택한 기자재 수량을 확인해 주세요.";
      break;
    }
    ids.add(i.id);
    if (i.qty > available(i.id, d.start, d.end, requests))
      e.items = `${equipment(i.id).name}의 대여 가능 수량이 부족해요. 수량이나 일정을 변경해 주세요.`;
  }
  return e;
}
export function createRequest(state, draft, now = Date.now()) {
  const errors = {
    ...validateProfile(draft),
    ...validateBooking(draft, state.requests, now),
  };
  if (!draft.agreed) errors.agreed = "대여 및 반납 안내를 확인해 주세요.";
  if (Object.keys(errors).length) return { errors };
  const id = crypto.randomUUID();
  const stamp = new Date(now).toISOString();
  const r = {
    ...draft,
    name: draft.name.trim(),
    studentId: draft.studentId.trim(),
    course: draft.course.trim(),
    professor: draft.professor.trim(),
    location: draft.location.trim(),
    purpose: draft.purpose.trim(),
    id,
    status: "pending",
    reason: "",
    createdAt: stamp,
    history: [{ status: "pending", at: stamp }],
  };
  const notification = {
    id: crypto.randomUUID(),
    requestId: id,
    audience: "admin",
    title: "새 대여 신청",
    body: `${r.name}님이 ${itemTitle(r.items)}을 신청했습니다.`,
    at: stamp,
    read: false,
  };
  return {
    request: r,
    state: {
      ...state,
      requests: [r, ...state.requests],
      notifications: [notification, ...state.notifications],
    },
  };
}
export function transition(state, id, status, reason = "", now = Date.now()) {
  const request = state.requests.find((r) => r.id === id);
  if (!request) return { error: "신청을 찾을 수 없습니다." };
  const allowed = {
    pending: ["approved", "rejected", "cancelled"],
    approved: ["borrowed", "cancelled"],
    borrowed: ["returned"],
  };
  if (!allowed[request.status]?.includes(status))
    return { error: "현재 상태에서 처리할 수 없는 요청입니다." };
  if (status === "rejected" && !reason.trim())
    return { error: "반려 사유를 입력해 주세요." };
  if (status === "approved" || status === "borrowed") {
    if (Date.parse(request.end) <= now)
      return {
        error:
          "대여 기간이 지난 신청입니다. 신청자에게 새 신청을 안내해 주세요.",
      };
    for (const i of request.items) {
      if (
        i.qty > available(i.id, request.start, request.end, state.requests, id)
      )
        return {
          error: `${equipment(i.id).name}의 대여 가능 수량이 부족합니다.`,
        };
    }
  }
  const stamp = new Date(now).toISOString();
  const updated = {
    ...request,
    status,
    reason: reason.trim(),
    history: [...request.history, { status, at: stamp }],
  };
  const titles = {
    approved: "대여 신청이 승인되었습니다",
    rejected: "대여 신청이 반려되었습니다",
    borrowed: "기자재 대여가 시작되었습니다",
    returned: "반납이 완료되었습니다",
    cancelled: "대여 신청이 취소되었습니다",
  };
  const notification = {
    id: crypto.randomUUID(),
    requestId: id,
    audience: status === "cancelled" ? "admin" : "student",
    title: titles[status],
    body: `${itemTitle(request.items)}${status === "rejected" ? ` · ${reason.trim()}` : ""}`,
    at: stamp,
    read: false,
  };
  return {
    request: updated,
    state: {
      ...state,
      requests: state.requests.map((r) => (r.id === id ? updated : r)),
      notifications: [notification, ...state.notifications],
    },
  };
}
export function demoState() {
  let state = initialState();
  for (const [index, name] of [
    "김도연",
    "이준혁",
    "최유진",
    "박서연",
  ].entries()) {
    const d = {
      ...freshDraft(),
      name,
      studentId: `2024${1852 + index}`,
      year: String((index % 4) + 1),
      course: [
        "영상제작실습",
        "사진표현기법",
        "스튜디오 조명",
        "사운드 디자인",
      ][index],
      professor: ["박진우", "김민정", "이현수", "정수진"][index],
      location: "교내 스튜디오",
      purpose: "수업 과제 촬영",
      start: dateInput(index + 1),
      end: dateInput(index + 2, 17),
      items: [{ id: CATALOG[index].id, qty: 1 }],
      agreed: true,
    };
    const result = createRequest(state, d);
    state = result.state;
    if (index === 1)
      state = transition(state, result.request.id, "approved").state;
    if (index === 2) {
      state = transition(state, result.request.id, "approved").state;
      state = transition(state, result.request.id, "borrowed").state;
    }
    if (index === 3)
      state = transition(
        state,
        result.request.id,
        "rejected",
        "선택한 기자재의 점검 일정으로 대여가 어렵습니다.",
      ).state;
  }
  return state;
}
export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return initialState();
    const s = JSON.parse(raw);
    if (
      s.version !== 1 ||
      !Array.isArray(s.requests) ||
      !Array.isArray(s.notifications)
    )
      throw new Error("invalid");
    return s;
  } catch {
    return initialState();
  }
}
export function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
