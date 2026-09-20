import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Bell,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle,
  CaretRight,
  X,
  CalendarBlank,
  MapPin,
  MagnifyingGlass,
  Minus,
  Plus,
  ClipboardText,
  SquaresFour,
  SlidersHorizontal,
  ArrowSquareOut,
  Package,
  Clock,
  Info,
  ShieldCheck,
  DownloadSimple,
  Trash,
  WarningCircle,
  GraduationCap,
  SignOut,
} from "@phosphor-icons/react";
import {
  CATALOG,
  STATUSES,
  STORE_KEY,
  DRAFT_KEY,
  available,
  freshDraft,
  initialState,
  demoState,
  loadState,
  createRequest,
  transition,
  validateProfile,
  validateBooking,
  itemTitle,
  equipment,
  formatDate,
  statusLabel,
  isOverdue,
} from "./domain.js";
import { mutateStore } from "./repository.js";
const base = import.meta.env.BASE_URL;
const STEPS = ["신청자 정보", "기자재·일정", "신청 확인"];
const NAV = [
  ["apply", "대여 신청", ClipboardText],
  ["requests", "내 신청", Package],
  ["catalog", "기자재", Camera],
];
function currentRoute() {
  return ["apply", "requests", "admin", "catalog", "notifications"].includes(
    location.hash.slice(1),
  )
    ? location.hash.slice(1)
    : "apply";
}
function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    return d && Array.isArray(d.items)
      ? { ...freshDraft(), ...d }
      : freshDraft();
  } catch {
    return freshDraft();
  }
}
function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
function Badge({ request }) {
  return (
    <span
      className={`badge ${isOverdue(request) ? "overdue" : request.status}`}
    >
      <span />
      {statusLabel(request)}
    </span>
  );
}
function Empty({ icon: Icon = Package, title, body, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={30} weight="light" />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
function Field({ label, name, error, children, optional = false }) {
  return (
    <div className={`field ${error ? "invalid" : ""}`}>
      <label htmlFor={name}>
        {label}
        {optional ? (
          <span>선택</span>
        ) : (
          <span className="required" aria-label="필수">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="field-error" id={`${name}-error`}>
          <WarningCircle size={15} />
          {error}
        </p>
      )}
    </div>
  );
}
function SummaryRows({ draft }) {
  return (
    <>
      <div className="summary-person">
        <span className="avatar">
          <GraduationCap size={22} />
        </span>
        <div>
          <strong>{draft.name || "신청자 정보 입력 중"}</strong>
          <p>
            {draft.studentId || "학번과 이름을 입력해 주세요."}
            {draft.year
              ? ` · ${draft.year === "기타" ? "기타" : draft.year + "학년"}`
              : ""}
          </p>
        </div>
      </div>
      {draft.items.length > 0 ? (
        <div className="summary-items">
          {draft.items.map((i) => (
            <div key={i.id}>
              <span>{equipment(i.id)?.name}</span>
              <strong>{i.qty}개</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="summary-placeholder">
          <Camera size={24} weight="light" />
          <span>대여할 기자재를 선택해 주세요.</span>
        </div>
      )}
      <dl className="summary-dates">
        <div>
          <dt>대여</dt>
          <dd>{formatDate(draft.start)}</dd>
        </div>
        <div>
          <dt>반납</dt>
          <dd>{formatDate(draft.end)}</dd>
        </div>
        <div>
          <dt>사용 구분</dt>
          <dd>{draft.use === "outside" ? "교외 반출" : "교내 사용"}</dd>
        </div>
      </dl>
    </>
  );
}
function Modal({ children, onClose, label, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
    return () => {};
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={label}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="닫기"
          autoFocus
        >
          <X size={22} />
        </button>
        {children}
      </div>
    </dialog>
  );
}
export function App() {
  const [state, setState] = useState(loadState),
    [draft, setDraft] = useState(readDraft),
    [route, setRoute] = useState(currentRoute),
    [mode, setMode] = useState(
      () => sessionStorage.getItem("loan-mode") || "student",
    ),
    [step, setStep] = useState(0),
    [errors, setErrors] = useState({}),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("전체"),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState(null),
    [toast, setToast] = useState(null),
    [success, setSuccess] = useState(null),
    [busy, setBusy] = useState(false),
    [settings, setSettings] = useState(false),
    [confirm, setConfirm] = useState(null),
    [permission, setPermission] = useState(() =>
      typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission,
    ),
    [unreadOnly, setUnreadOnly] = useState(false);
  const seen = useRef(new Set(state.notifications.map((n) => n.id)));
  const timer = useRef();
  function notify(message, type = "success") {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 5000);
  }
  function go(next) {
    location.hash = next;
    setRoute(next);
    setSearch("");
    setFilter("all");
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const handle = () => {
      setRoute(currentRoute());
      setSearch("");
      setFilter("all");
      setSelected(null);
    };
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, []);
  useEffect(() => {
    const sync = (e) => {
      if (e.key === STORE_KEY) setState(loadState());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      notify(
        "입력 내용을 저장할 수 없어요. 브라우저 저장 공간을 확인해 주세요.",
        "error",
      );
    }
  }, [draft]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register(`${base}sw.js`).catch(() => {});
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    for (const n of state.notifications) {
      if (!seen.current.has(n.id) && n.audience === mode) {
        notify(n.title);
        if (
          state.notificationEnabled &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.visibilityState !== "visible"
        ) {
          navigator.serviceWorker?.ready
            .then((reg) =>
              reg.showNotification(n.title, {
                body: n.body,
                tag: n.id,
                data: { path: "./#notifications" },
              }),
            )
            .catch(() => {});
        }
      }
      seen.current.add(n.id);
    }
  }, [state.notifications, mode]);
  async function mutate(action) {
    setBusy(true);
    try {
      const result = await mutateStore(action);
      if (result.state) setState(result.state);
      if (result.error) notify(result.error, "error");
      return result;
    } catch {
      notify(
        "저장하지 못했어요. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.",
        "error",
      );
      return { error: "저장 실패" };
    } finally {
      setBusy(false);
    }
  }
  function update(name, value) {
    setDraft((d) => ({ ...d, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }
  function switchMode(value) {
    setMode(value);
    sessionStorage.setItem("loan-mode", value);
    setSelected(null);
    go(value === "admin" ? "admin" : "apply");
  }
  function next() {
    const err =
      step === 0
        ? validateProfile(draft)
        : validateBooking(draft, state.requests);
    setErrors(err);
    if (Object.keys(err).length) {
      notify("입력한 내용을 확인해 주세요.", "error");
      setTimeout(
        () =>
          document
            .querySelector(
              ".invalid input, .invalid select, .invalid textarea, .invalid button, .field-error",
            )
            ?.focus(),
        0,
      );
      return;
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function selectItem(id) {
    setDraft((d) => ({
      ...d,
      items: d.items.some((i) => i.id === id)
        ? d.items.filter((i) => i.id !== id)
        : [...d.items, { id, qty: 1 }],
    }));
    setErrors((e) => ({ ...e, items: undefined }));
  }
  function quantity(id, delta) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.id === id
          ? {
              ...i,
              qty: Math.max(
                1,
                Math.min(
                  available(id, d.start, d.end, state.requests),
                  i.qty + delta,
                ),
              ),
            }
          : i,
      ),
    }));
  }
  async function submit() {
    const result = await mutate((s) => createRequest(s, draft));
    if (result.errors) {
      setErrors(result.errors);
      setStep(Object.keys(validateProfile(draft)).length ? 0 : 1);
      notify(Object.values(result.errors)[0], "error");
      return;
    }
    if (result.request) {
      setSuccess(result.request);
      setDraft(freshDraft());
      setStep(0);
    }
  }
  async function change(id, status, reason) {
    const result = await mutate((s) => transition(s, id, status, reason));
    if (result.request) {
      notify(`${STATUSES[status]} 처리했습니다.`);
      setSelected(null);
    }
    return result;
  }
  async function readNotifications(id) {
    await mutate((s) => ({
      state: {
        ...s,
        notifications: s.notifications.map((n) =>
          (id ? n.id === id : n.audience === mode) ? { ...n, read: true } : n,
        ),
      },
    }));
  }
  function openNotification(n) {
    readNotifications(n.id);
    setSelected(n.requestId);
  }
  async function enableNotifications() {
    if (
      typeof Notification === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      notify(
        "이 브라우저는 알림을 지원하지 않아요. 웹 알림함을 이용해 주세요.",
        "error",
      );
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await mutate((s) => ({ state: { ...s, notificationEnabled: true } }));
        notify("현재 브라우저의 알림을 켰어요.");
      } else notify("브라우저 설정에서 알림을 허용해 주세요.", "error");
    } catch {
      notify(
        "알림 권한을 요청할 수 없는 브라우저예요. 웹 알림함을 이용해 주세요.",
        "error",
      );
    }
  }
  async function testNotification() {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("기자재 대여·반출", {
        body: "브라우저 테스트 알림입니다. 새 신청은 웹 알림함에서 확인하세요.",
        tag: "test",
        data: { path: "./#notifications" },
      });
      notify("테스트 알림을 보냈어요.");
    } catch {
      notify(
        "브라우저 알림을 표시하지 못했어요. 권한과 기기 설정을 확인해 주세요.",
        "error",
      );
    }
  }
  function exportCsv() {
    const quote = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^[\s]*[=+@\-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "신청자",
        "학번",
        "학년",
        "수업명",
        "담당 교수",
        "기자재",
        "대여 일시",
        "반납 일시",
        "상태",
        "장소",
        "사용 목적",
      ],
      ...filteredRequests.map((r) => [
        r.name,
        r.studentId,
        r.year,
        r.course,
        r.professor,
        r.items.map((i) => `${equipment(i.id).name} ${i.qty}개`).join(" / "),
        r.start,
        r.end,
        statusLabel(r),
        r.location,
        r.purpose,
      ]),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((row) => row.map(quote).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    a.download = "기자재-대여-신청.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const notifications = state.notifications.filter((n) => n.audience === mode);
  const unread = notifications.filter((n) => !n.read).length;
  const selectedRequest = state.requests.find((r) => r.id === selected);
  const filteredRequests = state.requests.filter(
    (r) =>
      (filter === "all" ||
        (filter === "overdue" ? isOverdue(r) : r.status === filter)) &&
      `${r.name} ${r.studentId} ${r.course} ${itemTitle(r.items)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const filteredEquipment = CATALOG.filter(
    (e) =>
      (category === "전체" || e.category === category) &&
      `${e.name} ${e.subtitle}`.toLowerCase().includes(search.toLowerCase()),
  );
  const nav =
    mode === "admin"
      ? [
          ["admin", "신청 관리", ClipboardText],
          ["catalog", "기자재", Camera],
          ["notifications", "알림", Bell],
        ]
      : NAV;
  function equipmentCards(selectable) {
    return (
      <>
        <div className="equipment-toolbar">
          <div className="searchbox">
            <MagnifyingGlass size={20} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="기자재 검색"
              aria-label="기자재 검색"
            />
            {search && (
              <button
                className="icon-button"
                aria-label="검색 지우기"
                onClick={() => setSearch("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="chips">
            {["전체", "카메라", "렌즈", "조명", "오디오"].map((c) => (
              <button
                key={c}
                className={category === c ? "selected" : ""}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className={`equipment-grid ${selectable ? "selectable" : ""}`}>
          {filteredEquipment.map((e) => {
            const count = available(
              e.id,
              draft.start,
              draft.end,
              state.requests,
            );
            const picked = draft.items.find((i) => i.id === e.id);
            return (
              <article
                className={`equipment-card ${picked && selectable ? "picked" : ""} ${count === 0 ? "unavailable" : ""}`}
                key={e.id}
              >
                <div className="equipment-image">
                  <img src={`${base}equipment/${e.image}`} alt={e.name} />
                  <span className="equipment-category">{e.category}</span>
                  {selectable && (
                    <label className="equipment-check">
                      <input
                        type="checkbox"
                        checked={!!picked}
                        onChange={() => selectItem(e.id)}
                        disabled={count === 0 && !picked}
                        aria-label={`${e.name} 선택`}
                      />
                      <span>
                        <Check size={16} weight="bold" />
                      </span>
                    </label>
                  )}
                </div>
                <div className="equipment-body">
                  <h3>{e.name}</h3>
                  <p>{e.subtitle}</p>
                  <div className="equipment-bottom">
                    <span
                      className={`availability ${count === 0 ? "none" : ""}`}
                    >
                      <span />
                      {count > 0 ? `${count}개 대여 가능` : "대여 불가"}
                    </span>
                    {selectable && picked ? (
                      <div className="quantity">
                        <button
                          aria-label={`${e.name} 수량 줄이기`}
                          disabled={picked.qty <= 1}
                          onClick={() => quantity(e.id, -1)}
                        >
                          <Minus size={15} />
                        </button>
                        <output aria-label={`${e.name} 선택 수량`}>
                          {picked.qty}
                        </output>
                        <button
                          aria-label={`${e.name} 수량 늘리기`}
                          disabled={picked.qty >= count}
                          onClick={() => quantity(e.id, 1)}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="total">보유 {e.total}</span>
                    )}
                  </div>
                  {count === 0 && (
                    <p className="availability-note">
                      선택한 기간에 대여할 수 없어요.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {filteredEquipment.length === 0 && (
          <Empty
            icon={MagnifyingGlass}
            title="검색 결과가 없어요"
            body="다른 기자재 이름이나 카테고리를 선택해 주세요."
          />
        )}
      </>
    );
  }
  function reviewContent(r, editable = false) {
    return (
      <div className="review-sections">
        <section>
          <div className="section-heading">
            <h3>신청자 정보</h3>
            {editable && (
              <button className="text-button" onClick={() => setStep(0)}>
                수정
              </button>
            )}
          </div>
          <dl className="detail-grid">
            <div>
              <dt>이름 · 학번</dt>
              <dd>
                {r.name} · {r.studentId}
              </dd>
            </div>
            <div>
              <dt>학년</dt>
              <dd>{r.year === "기타" ? "기타" : r.year + "학년"}</dd>
            </div>
            <div>
              <dt>수업명</dt>
              <dd>{r.course}</dd>
            </div>
            <div>
              <dt>담당 교수님</dt>
              <dd>{r.professor}</dd>
            </div>
          </dl>
        </section>
        <section>
          <div className="section-heading">
            <h3>
              신청 기자재 <span>{r.items.length}종</span>
            </h3>
            {editable && (
              <button className="text-button" onClick={() => setStep(1)}>
                수정
              </button>
            )}
          </div>
          <div className="review-items">
            {r.items.map((i) => (
              <div key={i.id}>
                <img src={`${base}equipment/${equipment(i.id).image}`} alt="" />
                <div>
                  <strong>{equipment(i.id).name}</strong>
                  <span>{equipment(i.id).category}</span>
                </div>
                <b>{i.qty}개</b>
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="section-heading">
            <h3>일정과 사용 정보</h3>
            {editable && (
              <button className="text-button" onClick={() => setStep(1)}>
                수정
              </button>
            )}
          </div>
          <dl className="detail-grid">
            <div>
              <dt>대여 일시</dt>
              <dd>{formatDate(r.start)}</dd>
            </div>
            <div>
              <dt>반납 예정</dt>
              <dd>{formatDate(r.end)}</dd>
            </div>
            <div>
              <dt>사용 구분</dt>
              <dd>{r.use === "outside" ? "교외 반출" : "교내 사용"}</dd>
            </div>
            <div>
              <dt>장소</dt>
              <dd>{r.location}</dd>
            </div>
            <div className="span-two">
              <dt>사용 목적</dt>
              <dd>{r.purpose}</dd>
            </div>
          </dl>
        </section>
      </div>
    );
  }
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => go(mode === "admin" ? "admin" : "apply")}
            aria-label="기자재 대여·반출 홈"
          >
            <span className="brand-mark">
              <Camera size={23} weight="regular" />
            </span>
            <span>
              기자재 <span className="brand-light">대여·반출</span>
            </span>
          </button>
          <nav className="desktop-nav" aria-label="주 메뉴">
            {nav.map(([id, label]) => (
              <button
                key={id}
                className={route === id ? "active" : ""}
                onClick={() => go(id)}
                aria-current={route === id ? "page" : undefined}
              >
                {label}
                {id === "admin" &&
                  state.requests.some((r) => r.status === "pending") && (
                    <span className="nav-count">
                      {
                        state.requests.filter((r) => r.status === "pending")
                          .length
                      }
                    </span>
                  )}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className={`icon-button notification-button ${route === "notifications" ? "active" : ""}`}
              onClick={() => go("notifications")}
              aria-label={`알림 ${unread}개 미확인`}
            >
              <Bell size={23} />
              {unread > 0 && (
                <span className="notification-count">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <div className="header-divider" />
            <button
              className="mode-button"
              onClick={() =>
                switchMode(mode === "student" ? "admin" : "student")
              }
            >
              <span className={`mode-dot ${mode}`} />
              <span>{mode === "admin" ? "담당자" : "학생"} 체험</span>
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </div>
      </header>
      <div className="demo-bar">
        <div>
          <span className="demo-label">PREVIEW</span>
          <span>이 브라우저에만 저장되는 체험 버전입니다.</span>
          <button onClick={() => setSettings(true)}>
            체험 설정 <CaretRight size={13} />
          </button>
        </div>
      </div>
      <main
        id="main"
        className={`main-container ${route === "apply" && step === 1 ? "equipment-step" : ""}`}
      >
        {route === "apply" && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">새로운 신청</p>
                <h1>
                  대여 신청<span className="heading-dot">.</span>
                </h1>
                <p className="page-description">
                  {
                    [
                      "신청자 정보를 입력해 주세요.",
                      "일정에 맞는 기자재를 선택해 주세요.",
                      "신청 내용을 한 번 더 확인해 주세요.",
                    ][step]
                  }
                </p>
              </div>
              <ol className="steps" aria-label="신청 단계">
                {STEPS.map((s, i) => (
                  <li
                    key={s}
                    className={
                      i === step ? "current" : i < step ? "complete" : ""
                    }
                    aria-current={i === step ? "step" : undefined}
                  >
                    <span>
                      {i < step ? <Check size={14} weight="bold" /> : i + 1}
                    </span>
                    <b>{s}</b>
                    {i < 2 && <i />}
                  </li>
                ))}
              </ol>
            </div>
            <div className="application-layout">
              <div className="application-main">
                {step === 0 && (
                  <form
                    className="panel profile-panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      next();
                    }}
                    noValidate
                  >
                    <div className="panel-heading">
                      <div className="section-title">
                        <GraduationCap size={22} />
                        <h2>신청자 정보</h2>
                      </div>
                      <span className="quiet">모두 필수 항목</span>
                    </div>
                    <div className="form-grid">
                      <Field
                        label="학번"
                        name="studentId"
                        error={errors.studentId}
                      >
                        <input
                          id="studentId"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="학번을 입력해 주세요"
                          maxLength={12}
                          value={draft.studentId}
                          onChange={(e) =>
                            update(
                              "studentId",
                              e.target.value.replace(/\D/g, ""),
                            )
                          }
                          aria-invalid={!!errors.studentId}
                          aria-describedby={
                            errors.studentId ? "studentId-error" : undefined
                          }
                        />
                      </Field>
                      <Field label="이름" name="name" error={errors.name}>
                        <input
                          id="name"
                          autoComplete="name"
                          placeholder="이름을 입력해 주세요"
                          maxLength={40}
                          value={draft.name}
                          onChange={(e) => update("name", e.target.value)}
                          aria-invalid={!!errors.name}
                          aria-describedby={
                            errors.name ? "name-error" : undefined
                          }
                        />
                      </Field>
                      <div
                        className={`field span-two ${errors.year ? "invalid" : ""}`}
                      >
                        <span className="field-label" id="year-label">
                          학년 <span className="required">*</span>
                        </span>
                        <div
                          className="segment years"
                          role="group"
                          aria-labelledby="year-label"
                        >
                          {["1", "2", "3", "4", "기타"].map((y) => (
                            <button
                              key={y}
                              type="button"
                              className={draft.year === y ? "selected" : ""}
                              onClick={() => update("year", y)}
                              aria-pressed={draft.year === y}
                            >
                              {y === "기타" ? y : `${y}학년`}
                            </button>
                          ))}
                        </div>
                        {errors.year && (
                          <p className="field-error">{errors.year}</p>
                        )}
                      </div>
                      <div className="span-two">
                        <Field
                          label="수업명"
                          name="course"
                          error={errors.course}
                        >
                          <input
                            id="course"
                            placeholder="예: 영상제작실습"
                            maxLength={80}
                            value={draft.course}
                            onChange={(e) => update("course", e.target.value)}
                            aria-invalid={!!errors.course}
                            aria-describedby={
                              errors.course ? "course-error" : undefined
                            }
                          />
                        </Field>
                      </div>
                      <div className="span-two">
                        <Field
                          label="담당 교수님 성함"
                          name="professor"
                          error={errors.professor}
                        >
                          <input
                            id="professor"
                            placeholder="교수님 성함을 입력해 주세요"
                            maxLength={40}
                            value={draft.professor}
                            onChange={(e) =>
                              update("professor", e.target.value)
                            }
                            aria-invalid={!!errors.professor}
                            aria-describedby={
                              errors.professor ? "professor-error" : undefined
                            }
                          />
                        </Field>
                      </div>
                    </div>
                    <div className="form-footer">
                      <span className="autosave">
                        <CheckCircle size={16} />
                        입력 내용 자동 저장
                      </span>
                      <Button type="submit">
                        다음: 기자재 선택 <ArrowRight size={18} />
                      </Button>
                    </div>
                  </form>
                )}
                {step === 1 && (
                  <>
                    <section className="panel schedule-panel">
                      <div className="panel-heading">
                        <div className="section-title">
                          <CalendarBlank size={22} />
                          <h2>대여 일정</h2>
                        </div>
                      </div>
                      <div className="form-grid">
                        <Field
                          label="대여 일시"
                          name="start"
                          error={errors.start}
                        >
                          <input
                            type="datetime-local"
                            id="start"
                            value={draft.start}
                            onChange={(e) => update("start", e.target.value)}
                            aria-invalid={!!errors.start}
                          />
                        </Field>
                        <Field
                          label="반납 예정 일시"
                          name="end"
                          error={errors.end}
                        >
                          <input
                            type="datetime-local"
                            id="end"
                            value={draft.end}
                            min={draft.start}
                            onChange={(e) => update("end", e.target.value)}
                            aria-invalid={!!errors.end}
                          />
                        </Field>
                        <div className="field span-two">
                          <span className="field-label" id="use-label">
                            사용 구분
                          </span>
                          <div
                            className="segment"
                            role="group"
                            aria-labelledby="use-label"
                          >
                            {[
                              ["inside", "교내 사용"],
                              ["outside", "교외 반출"],
                            ].map(([v, l]) => (
                              <button
                                key={v}
                                className={draft.use === v ? "selected" : ""}
                                aria-pressed={draft.use === v}
                                onClick={() => update("use", v)}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Field
                          label={
                            draft.use === "outside" ? "반출 장소" : "사용 장소"
                          }
                          name="location"
                          error={errors.location}
                        >
                          <input
                            id="location"
                            placeholder={
                              draft.use === "outside"
                                ? "반출할 장소를 입력해 주세요"
                                : "예: 교내 스튜디오"
                            }
                            maxLength={120}
                            value={draft.location}
                            onChange={(e) => update("location", e.target.value)}
                            aria-invalid={!!errors.location}
                          />
                        </Field>
                        <Field
                          label={
                            draft.use === "outside"
                              ? "사용 목적 · 반출 사유"
                              : "사용 목적"
                          }
                          name="purpose"
                          error={errors.purpose}
                        >
                          <input
                            id="purpose"
                            placeholder="예: 수업 과제 촬영"
                            maxLength={200}
                            value={draft.purpose}
                            onChange={(e) => update("purpose", e.target.value)}
                            aria-invalid={!!errors.purpose}
                          />
                        </Field>
                      </div>
                    </section>
                    <section className="equipment-section">
                      <div className="section-heading">
                        <h2>
                          기자재 선택 <span>{CATALOG.length}</span>
                        </h2>
                        <span className="quiet">선택한 일정 기준</span>
                      </div>
                      {errors.items && (
                        <p className="alert error" role="alert">
                          <WarningCircle size={18} />
                          {errors.items}
                        </p>
                      )}
                      {equipmentCards(true)}
                    </section>
                    <div className="booking-actions">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setStep(0);
                          window.scrollTo(0, 0);
                        }}
                      >
                        <ArrowLeft size={17} />
                        이전
                      </Button>
                      <span>
                        <strong>{draft.items.length}종</strong> 선택 · 총{" "}
                        {draft.items.reduce((n, i) => n + i.qty, 0)}개
                      </span>
                      <Button onClick={next}>
                        다음: 신청 확인 <ArrowRight size={18} />
                      </Button>
                    </div>
                  </>
                )}
                {step === 2 && (
                  <section className="panel review-panel">
                    <div className="panel-heading">
                      <div className="section-title">
                        <ClipboardText size={22} />
                        <h2>신청 내용 확인</h2>
                      </div>
                      <span className="quiet">제출 전 확인</span>
                    </div>
                    {reviewContent(draft, true)}
                    <div className="agreement">
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.agreed}
                          onChange={(e) => update("agreed", e.target.checked)}
                        />
                        <span>대여·반납 안내를 확인했습니다.</span>
                      </label>
                      <p>
                        승인 후 기자재를 수령하고, 정해진 반납 일시를 지켜
                        주세요. 기자재 이상은 담당자에게 알려 주세요.
                      </p>
                    </div>
                    <div className="form-footer">
                      <Button variant="secondary" onClick={() => setStep(1)}>
                        <ArrowLeft size={17} />
                        이전
                      </Button>
                      <Button disabled={!draft.agreed || busy} onClick={submit}>
                        {busy ? "신청 중…" : "대여 신청하기"}
                        <ArrowRight size={18} />
                      </Button>
                    </div>
                  </section>
                )}
              </div>
              <aside className="application-aside">
                <div className="summary-panel">
                  <div className="section-heading">
                    <h2>신청 요약</h2>
                    <span className="summary-step">
                      {String(step + 1).padStart(2, "0")}
                      <span> / 03</span>
                    </span>
                  </div>
                  <SummaryRows draft={draft} />
                </div>
                <div className="aside-note">
                  <ShieldCheck size={21} />
                  <p>
                    담당자 승인 후 대여할 수 있어요.
                    <br />
                    처리 결과는 알림에서 확인해 주세요.
                  </p>
                </div>
                {step === 0 && (
                  <div className="aside-link">
                    <span>이미 신청하셨나요?</span>
                    <button
                      className="text-button"
                      onClick={() => go("requests")}
                    >
                      내 신청 확인 <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
        {(route === "requests" || route === "admin") && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  {route === "admin" ? "담당자 워크스페이스" : "나의 대여 기록"}
                </p>
                <h1>
                  {route === "admin" ? "신청 관리" : "내 신청"}
                  <span className="heading-dot">.</span>
                </h1>
                <p className="page-description">
                  {route === "admin"
                    ? "접수된 신청을 확인하고 대여와 반납을 관리하세요."
                    : "이 브라우저에서 신청한 내역을 확인하세요."}
                </p>
              </div>
              {route === "admin" ? (
                <Button
                  variant="secondary"
                  onClick={exportCsv}
                  disabled={!filteredRequests.length}
                >
                  <DownloadSimple size={18} />
                  목록 내보내기
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setStep(0);
                    go("apply");
                  }}
                >
                  <Plus size={18} />새 신청
                </Button>
              )}
            </div>
            {route === "admin" && (
              <div className="stats">
                {[
                  ["pending", "승인 대기", Clock],
                  ["approved", "대여 준비", Package],
                  ["borrowed", "대여 중", Camera],
                  ["overdue", "반납 지연", WarningCircle],
                ].map(([key, label, Icon]) => (
                  <button
                    className={`stat ${filter === key ? "active" : ""} ${key === "overdue" ? "danger-stat" : ""}`}
                    key={key}
                    onClick={() => setFilter(filter === key ? "all" : key)}
                  >
                    <span className="stat-label">
                      {label}
                      <Icon size={21} />
                    </span>
                    <strong>
                      {
                        state.requests.filter((r) =>
                          key === "overdue" ? isOverdue(r) : r.status === key,
                        ).length
                      }
                      <small>건</small>
                    </strong>
                  </button>
                ))}
              </div>
            )}
            <section className="panel list-panel">
              <div className="list-toolbar">
                <div className="filter-tabs">
                  {[
                    ["all", "전체"],
                    ["pending", "승인 대기"],
                    ["borrowed", "대여 중"],
                    ["returned", "반납 완료"],
                  ].map(([key, label]) => (
                    <button
                      className={filter === key ? "selected" : ""}
                      key={key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                      {key === "all" && <span>{state.requests.length}</span>}
                    </button>
                  ))}
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    aria-label="신청 상태 필터"
                  >
                    <option value="all">전체 상태</option>
                    {Object.entries(STATUSES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                    <option value="overdue">연체</option>
                  </select>
                </div>
                <div className="searchbox compact">
                  <MagnifyingGlass size={18} />
                  <input
                    placeholder="이름, 학번, 기자재 검색"
                    aria-label="신청 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              {filteredRequests.length > 0 ? (
                <>
                  <div className="request-table-wrap">
                    <table className="request-table">
                      <thead>
                        <tr>
                          <th>신청자</th>
                          <th>신청 기자재</th>
                          <th>대여 기간</th>
                          <th>상태</th>
                          <th>
                            <span className="sr-only">상세보기</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRequests.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <div className="person-cell">
                                <span className="avatar small">
                                  {r.name.slice(0, 1)}
                                </span>
                                <div>
                                  <strong>{r.name}</strong>
                                  <small>
                                    {r.studentId} ·{" "}
                                    {r.year === "기타"
                                      ? "기타"
                                      : r.year + "학년"}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <strong>{itemTitle(r.items)}</strong>
                              <small>{r.course}</small>
                            </td>
                            <td>
                              <span className="date-cell">
                                {formatDate(r.start)}
                                <br />
                                <span>— {formatDate(r.end)}</span>
                              </span>
                            </td>
                            <td>
                              <Badge request={r} />
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`${r.name} ${itemTitle(r.items)} 신청 상세`}
                                onClick={() => setSelected(r.id)}
                              >
                                <CaretRight size={20} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="request-cards">
                    {filteredRequests.map((r) => (
                      <button
                        key={r.id}
                        className="request-card"
                        onClick={() => setSelected(r.id)}
                      >
                        <div className="request-card-top">
                          <span>
                            {r.name} <small>{r.studentId}</small>
                          </span>
                          <Badge request={r} />
                        </div>
                        <div className="request-card-main">
                          <img
                            src={`${base}equipment/${equipment(r.items[0].id).image}`}
                            alt=""
                          />
                          <div>
                            <strong>{itemTitle(r.items)}</strong>
                            <span>
                              {formatDate(r.start, false)} —{" "}
                              {formatDate(r.end, false)}
                            </span>
                          </div>
                          <CaretRight size={18} />
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="list-footer">
                    신청 {filteredRequests.length}건
                  </div>
                </>
              ) : (
                <Empty
                  icon={ClipboardText}
                  title={
                    state.requests.length
                      ? "조건에 맞는 신청이 없어요"
                      : "아직 신청 내역이 없어요"
                  }
                  body={
                    state.requests.length
                      ? "검색어나 상태 필터를 바꿔 보세요."
                      : "첫 기자재 대여를 신청해 보세요."
                  }
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (state.requests.length) {
                          setFilter("all");
                          setSearch("");
                        } else go("apply");
                      }}
                    >
                      {state.requests.length ? "필터 초기화" : "대여 신청하기"}
                      <ArrowRight size={16} />
                    </Button>
                  }
                />
              )}
            </section>
          </>
        )}
        {route === "catalog" && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">기자재 라이브러리</p>
                <h1>
                  어떤 장비가 필요한가요<span className="heading-dot">?</span>
                </h1>
                <p className="page-description">
                  촬영에 필요한 기자재와 대여 가능 수량을 확인하세요.
                </p>
              </div>
              <Button
                onClick={() => {
                  switchMode("student");
                  setStep(0);
                }}
              >
                대여 신청 <ArrowRight size={18} />
              </Button>
            </div>
            <div className="catalog-dates panel">
              <CalendarBlank size={22} />
              <label>
                대여
                <input
                  type="datetime-local"
                  value={draft.start}
                  onChange={(e) => update("start", e.target.value)}
                />
              </label>
              <label>
                반납
                <input
                  type="datetime-local"
                  value={draft.end}
                  min={draft.start}
                  onChange={(e) => update("end", e.target.value)}
                />
              </label>
            </div>
            {equipmentCards(false)}
            <p className="catalog-note">
              <Info size={16} />
              시안에 포함된 예시 기자재입니다. 실제 보유 목록은 운영 전 등록할
              예정이에요.
            </p>
          </>
        )}
        {route === "notifications" && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  {mode === "admin" ? "담당자 알림" : "나의 알림"}
                </p>
                <h1>
                  알림<span className="heading-dot">.</span>
                </h1>
                <p className="page-description">
                  {unread
                    ? `아직 읽지 않은 알림이 ${unread}개 있어요.`
                    : "새로운 소식을 여기서 확인하세요."}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setSettings(true)}>
                <SlidersHorizontal size={18} />
                알림 설정
              </Button>
            </div>
            <section className="panel notifications-panel">
              <div className="list-toolbar">
                <div className="filter-tabs">
                  <button
                    className={!unreadOnly ? "selected" : ""}
                    onClick={() => setUnreadOnly(false)}
                  >
                    전체 <span>{notifications.length}</span>
                  </button>
                  <button
                    className={unreadOnly ? "selected" : ""}
                    onClick={() => setUnreadOnly(true)}
                  >
                    읽지 않음 <span>{unread}</span>
                  </button>
                </div>
                <button
                  className="text-button"
                  disabled={!unread}
                  onClick={() => readNotifications()}
                >
                  <Check size={16} />
                  모두 읽음
                </button>
              </div>
              {notifications.filter((n) => !unreadOnly || !n.read).length ? (
                notifications
                  .filter((n) => !unreadOnly || !n.read)
                  .map((n) => (
                    <button
                      className={`notification-item ${!n.read ? "unread" : ""}`}
                      key={n.id}
                      onClick={() => openNotification(n)}
                    >
                      <span className="notification-icon">
                        {n.audience === "admin" ? (
                          <ClipboardText size={23} />
                        ) : (
                          <Bell size={23} />
                        )}
                      </span>
                      <div>
                        <div className="notification-title">
                          <strong>{n.title}</strong>
                          {!n.read && <span className="unread-dot" />}
                        </div>
                        <p>{n.body}</p>
                        <time>{formatDate(n.at)}</time>
                      </div>
                      <CaretRight size={18} />
                    </button>
                  ))
              ) : (
                <Empty
                  icon={Bell}
                  title={
                    unreadOnly
                      ? "모든 알림을 확인했어요"
                      : "아직 도착한 알림이 없어요"
                  }
                  body={
                    mode === "admin"
                      ? "새 대여 신청이 들어오면 이곳에 표시됩니다."
                      : "신청 승인과 반납 소식을 이곳에서 알려드려요."
                  }
                />
              )}
            </section>
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>기자재 대여·반출</span>
        <span>선택부터 반납까지, 한곳에서.</span>
        <button onClick={() => setSettings(true)}>체험 설정</button>
      </footer>
      <nav className="mobile-nav" aria-label="모바일 주 메뉴">
        {[
          ...nav.filter((x) => x[0] !== "notifications"),
          ["notifications", "알림", Bell],
        ].map(([id, label, Icon]) => (
          <button
            key={id}
            className={route === id ? "active" : ""}
            onClick={() => go(id)}
            aria-current={route === id ? "page" : undefined}
          >
            <span>
              <Icon size={22} weight={route === id ? "fill" : "regular"} />
              {id === "notifications" && unread > 0 && <i />}
            </span>
            {label}
          </button>
        ))}
      </nav>
      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.type === "error" ? (
            <WarningCircle size={22} />
          ) : (
            <CheckCircle size={22} />
          )}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="안내 닫기"
            onClick={() => setToast(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {success && (
        <Modal
          onClose={() => {
            setSuccess(null);
            go("requests");
          }}
          label="신청 접수 완료"
        >
          <div className="success-content">
            <span className="success-icon">
              <Check size={36} weight="bold" />
            </span>
            <p className="eyebrow">신청 완료</p>
            <h2>신청이 접수되었어요.</h2>
            <p>
              담당자 확인 후 처리 결과를
              <br />
              알림에서 알려드릴게요.
            </p>
            <div className="success-summary">
              <strong>{itemTitle(success.items)}</strong>
              <span>
                {formatDate(success.start, false)} —{" "}
                {formatDate(success.end, false)}
              </span>
              <Badge request={success} />
            </div>
            <Button
              onClick={() => {
                setSuccess(null);
                go("requests");
              }}
            >
              내 신청 확인 <ArrowRight size={18} />
            </Button>
            <button
              className="text-button"
              onClick={() => {
                setSuccess(null);
                switchMode("admin");
              }}
            >
              담당자 화면에서 승인 체험하기 <ArrowSquareOut size={15} />
            </button>
          </div>
        </Modal>
      )}
      {selectedRequest && (
        <Detail
          request={selectedRequest}
          mode={mode}
          busy={busy}
          onClose={() => setSelected(null)}
          change={change}
          reviewContent={reviewContent}
        />
      )}
      {settings && (
        <Modal label="체험 및 알림 설정" onClose={() => setSettings(false)}>
          <div className="settings-content">
            <p className="eyebrow">설정</p>
            <h2>체험과 알림</h2>
            <div className="setting-block">
              <div className="section-title">
                <Bell size={22} />
                <h3>브라우저 알림</h3>
              </div>
              <p>
                현재 브라우저에서 다른 탭을 보고 있을 때 도착한 알림을 표시해요.
                웹을 닫은 뒤 받는 푸시 알림은 아직 연결되지 않았어요.
              </p>
              <div className="setting-row">
                <span>
                  {permission === "unsupported"
                    ? "이 브라우저는 지원하지 않아요"
                    : permission === "denied"
                      ? "브라우저 설정에서 허용해 주세요"
                      : state.notificationEnabled && permission === "granted"
                        ? "알림 사용 중"
                        : "알림 꺼짐"}
                </span>
                {permission === "granted" && state.notificationEnabled ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      mutate((s) => ({
                        state: { ...s, notificationEnabled: false },
                      }))
                    }
                  >
                    끄기
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={
                      permission === "unsupported" || permission === "denied"
                    }
                    onClick={enableNotifications}
                  >
                    알림 켜기
                  </Button>
                )}
              </div>
              {permission === "granted" && state.notificationEnabled && (
                <button className="text-button" onClick={testNotification}>
                  테스트 알림 보내기 <ArrowSquareOut size={15} />
                </button>
              )}
            </div>
            <div className="setting-block">
              <div className="section-title">
                <SquaresFour size={22} />
                <h3>체험 데이터</h3>
              </div>
              <p>
                신청과 알림은 이 브라우저에만 저장돼요. 다른 기기로 전달되지
                않으며, 학생·담당자 전환은 기능을 살펴보기 위한 체험 기능이에요.
                실제 개인정보 대신 예시 정보를 사용해 주세요.
              </p>
              <div className="setting-buttons">
                <Button
                  variant="secondary"
                  onClick={() => setConfirm("sample")}
                >
                  예시 신청 불러오기
                </Button>
                <Button
                  variant="danger-ghost"
                  onClick={() => setConfirm("reset")}
                >
                  <Trash size={17} />
                  초기화
                </Button>
              </div>
            </div>
            <Button className="full" onClick={() => setSettings(false)}>
              확인
            </Button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal label="체험 데이터 변경 확인" onClose={() => setConfirm(null)}>
          <div className="confirm-content">
            <h2>
              {confirm === "reset"
                ? "체험 데이터를 지울까요?"
                : "예시 신청을 불러올까요?"}
            </h2>
            <p>
              현재 브라우저에 저장된 신청과 알림이{" "}
              {confirm === "reset"
                ? "삭제됩니다. 입력 중인 신청서도 초기화됩니다."
                : "예시 데이터로 교체됩니다."}{" "}
              이 작업은 되돌릴 수 없어요.
            </p>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                취소
              </Button>
              <Button
                onClick={async () => {
                  const r = await mutate(() => ({
                    state: confirm === "reset" ? initialState() : demoState(),
                  }));
                  if (!r.error) {
                    if (confirm === "reset") {
                      setDraft(freshDraft());
                      setStep(0);
                    }
                    setConfirm(null);
                    setSettings(false);
                    notify("체험 데이터를 업데이트했어요.");
                  }
                }}
              >
                계속
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function Detail({ request: r, mode, onClose, busy, change, reviewContent }) {
  const [reject, setReject] = useState(false),
    [reason, setReason] = useState(""),
    [cancel, setCancel] = useState(false);
  return (
    <Modal label="신청 상세" wide onClose={onClose}>
      <div className="detail-header">
        <p className="eyebrow">신청 상세</p>
        <h2>{itemTitle(r.items)}</h2>
        <div>
          <Badge request={r} />
          <span className="quiet">{formatDate(r.createdAt)} 신청</span>
        </div>
      </div>
      <div className="detail-body">
        {r.status === "rejected" && (
          <div className="alert error">
            <WarningCircle size={20} />
            <div>
              <strong>반려 사유</strong>
              <p>{r.reason}</p>
            </div>
          </div>
        )}
        {reviewContent(r)}
        <section className="history-section">
          <h3>처리 이력</h3>
          <ol>
            {r.history.map((h, i) => (
              <li key={i}>
                <span />
                <strong>{STATUSES[h.status]}</strong>
                <time>{formatDate(h.at)}</time>
              </li>
            ))}
          </ol>
        </section>
        {reject && (
          <div className="reject-form">
            <Field label="반려 사유" name="reason">
              <textarea
                autoFocus
                id="reason"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="신청자가 확인할 수 있도록 사유를 적어 주세요."
                rows={3}
              />
            </Field>
          </div>
        )}
        {cancel && (
          <div className="alert">
            <Info size={18} />
            신청을 취소할까요? 취소 후에는 새로 신청해야 해요.
          </div>
        )}
      </div>
      <div className="detail-actions">
        {mode === "admin" && r.status === "pending" ? (
          reject ? (
            <>
              <Button variant="secondary" onClick={() => setReject(false)}>
                돌아가기
              </Button>
              <Button
                variant="danger"
                disabled={!reason.trim() || busy}
                onClick={() => change(r.id, "rejected", reason)}
              >
                반려 확정
              </Button>
            </>
          ) : (
            <>
              <Button variant="danger-ghost" onClick={() => setReject(true)}>
                반려
              </Button>
              <Button disabled={busy} onClick={() => change(r.id, "approved")}>
                <Check size={18} />
                신청 승인
              </Button>
            </>
          )
        ) : mode === "admin" && r.status === "approved" ? (
          <Button disabled={busy} onClick={() => change(r.id, "borrowed")}>
            <Package size={18} />
            기자재 인도 완료
          </Button>
        ) : mode === "admin" && r.status === "borrowed" ? (
          <Button disabled={busy} onClick={() => change(r.id, "returned")}>
            <CheckCircle size={18} />
            반납 확인
          </Button>
        ) : mode === "student" && ["pending", "approved"].includes(r.status) ? (
          cancel ? (
            <>
              <Button variant="secondary" onClick={() => setCancel(false)}>
                돌아가기
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => change(r.id, "cancelled")}
              >
                신청 취소 확정
              </Button>
            </>
          ) : (
            <>
              <Button variant="danger-ghost" onClick={() => setCancel(true)}>
                신청 취소
              </Button>
              <Button onClick={onClose}>확인</Button>
            </>
          )
        ) : (
          <Button onClick={onClose}>확인</Button>
        )}
      </div>
    </Modal>
  );
}
