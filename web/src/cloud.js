import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  setDoc,
  serverTimestamp,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  setCatalog,
  available,
  validateProfile,
  validateBooking,
  STATUSES,
  itemTitle,
} from "./domain.js";
export const emulatorMode =
  import.meta.env?.DEV && import.meta.env.VITE_EMULATORS === "true";
const app = initializeApp({
  apiKey: "AIzaSyDlg7pWy9xPNB6MyBkeklTCMcl6R4XAgIw",
  authDomain: "equipment-loan-yslab-2026.firebaseapp.com",
  projectId: emulatorMode ? "demo-equipment-loan" : "equipment-loan-yslab-2026",
  appId: "1:528865334005:web:04cc0bc18d6e64ec78abbc",
});
export const auth = getAuth(app);
export const db = getFirestore(app, emulatorMode ? "(default)" : "equipment");
if (emulatorMode) {
  connectAuthEmulator(auth, "http://127.0.0.1:9299");
  connectFirestoreEmulator(db, "127.0.0.1", 8280);
}
export const isAdmin = (user) =>
  user?.emailVerified && user.email === "yunseonglab@gmail.com";
export const observeAuth = (callback) => onAuthStateChanged(auth, callback);
export const login = () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
};
export const enterStudent = () => signInAnonymously(auth);
export const logout = () => signOut(auth);
const lockRef = (database = db) => doc(database, "system", "schedule");
function iso(value) {
  return value?.toDate
    ? value.toDate().toISOString()
    : new Date(value).toISOString();
}
function normalize(id, data) {
  return {
    ...data,
    id,
    start: iso(data.start),
    end: iso(data.end),
    createdAt: iso(data.createdAt),
    history: Object.entries(data.history)
      .map(([status, at]) => ({ status, at: iso(at) }))
      .sort((a, b) => a.at.localeCompare(b.at)),
  };
}
export function watchService(user, callback, onError) {
  let requests = [],
    recent = [],
    active = [],
    reservations = [],
    ready = new Set(),
    readThrough = 0,
    catalog = [];
  let alive = true;
  const required = isAdmin(user) ? 5 : 4;
  const emit = () => {
    if (!alive || ready.size !== required) return;
    setCatalog(catalog);
    const notifications = requests
      .flatMap((r) =>
        r.history.map((h) => ({
          id: `${r.id}:${h.status}`,
          requestId: r.id,
          uid: r.uid,
          audience:
            h.status === "pending" || h.status === "cancelled"
              ? "admin"
              : "student",
          title:
            h.status === "pending"
              ? "새 대여 신청"
              : `대여 신청 ${STATUSES[h.status]}`,
          body: `${r.name} · ${itemTitle(r.items)}${h.status === "rejected" ? " · " + r.reason : ""}`,
          at: h.at,
          read: Date.parse(h.at) <= readThrough,
        })),
      )
      .sort((a, b) => b.at.localeCompare(a.at));
    callback({
      version: 2,
      requests,
      reservations,
      notifications,
      ready: true,
    });
  };
  const failed = (error) => {
    ready.clear();
    onError(error);
  };
  // Realtime snapshots are required for open-web alerts; owner filtering happens on the server.
  const requestQuery = isAdmin(user)
    ? query(
        collection(db, "requests"),
        orderBy("createdAt", "desc"),
        limit(100),
      )
    : query(
        collection(db, "requests"),
        where("uid", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(100),
      );
  const stops = [
    onSnapshot(
      query(collection(db, "catalog"), limit(100)),
      { includeMetadataChanges: true },
      (s) => {
        if (s.metadata.hasPendingWrites) return;
        catalog = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        ready.add("catalog");
        emit();
      },
      failed,
    ),
    onSnapshot(
      requestQuery,
      { includeMetadataChanges: true },
      (s) => {
        if (s.metadata.hasPendingWrites) return;
        recent = s.docs.map((d) => normalize(d.id, d.data()));
        requests = [
          ...new Map([...recent, ...active].map((r) => [r.id, r])).values(),
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        ready.add("requests");
        emit();
      },
      failed,
    ),
    onSnapshot(
      lockRef(),
      { includeMetadataChanges: true },
      (s) => {
        if (s.metadata.hasPendingWrites) return;
        reservations = s.exists() ? JSON.parse(s.data().bookings) : [];
        ready.add("schedule");
        emit();
      },
      failed,
    ),
    onSnapshot(
      doc(db, "users", user.uid),
      { includeMetadataChanges: true },
      (s) => {
        if (s.metadata.hasPendingWrites) return;
        readThrough = s.data()?.readThrough?.toMillis() || 0;
        ready.add("reads");
        emit();
      },
      failed,
    ),
  ];
  if (isAdmin(user))
    stops.push(
      onSnapshot(
        query(
          collection(db, "requests"),
          where("status", "in", ["pending", "approved", "borrowed"]),
          limit(300),
        ),
        { includeMetadataChanges: true },
        (s) => {
          if (s.metadata.hasPendingWrites) return;
          active = s.docs.map((d) => normalize(d.id, d.data()));
          requests = [
            ...new Map([...recent, ...active].map((r) => [r.id, r])).values(),
          ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          ready.add("active");
          emit();
        },
        failed,
      ),
    );
  return () => {
    alive = false;
    stops.forEach((stop) => stop());
  };
}
export async function submitRequest(
  draft,
  reservations,
  id = crypto.randomUUID(),
  context = { database: db, user: auth.currentUser },
) {
  const { database: db, user } = context;
  if (!user) throw new Error("먼저 로그인해 주세요.");
  const errors = {
    ...validateProfile(draft),
    ...validateBooking(draft, reservations),
  };
  if (!draft.agreed) errors.agreed = "대여 안내에 동의해 주세요.";
  if (Object.keys(errors).length) return { errors };
  const ref = doc(db, "requests", id),
    userRef = doc(db, "users", user.uid);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) return;
    const profile = await tx.get(userRef);
    const last = profile.data()?.lastSubmit?.toMillis() || 0;
    if (Date.now() - last < 15000)
      throw new Error("잠시 후 다시 신청해 주세요.");
    const data = {
      uid: user.uid,
      name: draft.name.trim(),
      studentId: draft.studentId.trim(),
      start: Date.parse(draft.start),
      end: Date.parse(draft.end),
      use: draft.use,
      location: draft.location.trim(),
      purpose: draft.purpose.trim(),
      items: draft.items.map((i) => ({ id: i.id, qty: i.qty })),
      agreed: true,
      status: "pending",
      reason: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: { pending: serverTimestamp() },
    };
    tx.set(ref, data);
    tx.set(
      userRef,
      { lastSubmit: serverTimestamp(), lastRequestId: id },
      { merge: true },
    );
  });
  return { request: { ...draft, id, status: "pending" } };
}
export async function changeRequest(
  id,
  status,
  reason = "",
  context = { database: db, user: auth.currentUser },
) {
  const { database: db, user } = context;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "requests", id),
      snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error("신청을 찾을 수 없습니다.");
    const r = normalize(id, snapshot.data());
    const allowed = {
      pending: ["approved", "rejected", "cancelled"],
      approved: ["borrowed", "cancelled"],
      borrowed: ["returned"],
    };
    if (!allowed[r.status]?.includes(status))
      throw new Error("이미 처리되었거나 변경할 수 없는 상태입니다.");
    if (!isAdmin(user) && (r.status !== "pending" || status !== "cancelled"))
      throw new Error("담당자만 처리할 수 있습니다.");
    if (status === "rejected" && !reason.trim())
      throw new Error("반려 사유를 입력해 주세요.");
    if (isAdmin(user)) {
      const schedule = await tx.get(lockRef(db));
      let bookings = schedule.exists()
        ? JSON.parse(schedule.data().bookings)
        : [];
      const bookingStart =
        status === "borrowed"
          ? new Date(Math.min(Date.parse(r.start), Date.now())).toISOString()
          : r.start;
      const items = await Promise.all(
        r.items.map((i) => tx.get(doc(db, "catalog", i.id))),
      );
      if (["approved", "borrowed"].includes(status)) {
        if (Date.parse(r.end) <= Date.now())
          throw new Error("대여 기간이 지난 신청입니다.");
        for (let n = 0; n < r.items.length; n++) {
          const item = r.items[n],
            current = items[n].data();
          if (!current) throw new Error("삭제된 장비가 포함되어 있습니다.");
          // Use transaction-fresh inventory, never a stale listener value.
          const count = available(
            item.id,
            bookingStart,
            r.end,
            bookings,
            id,
            current.total,
          );
          if (item.qty > count)
            throw new Error(`${current.name}의 남은 수량이 부족합니다.`);
        }
      }
      bookings = bookings.filter(
        (b) =>
          b.id !== id &&
          (b.status === "borrowed" || Date.parse(b.end) > Date.now()),
      );
      if (["approved", "borrowed"].includes(status))
        bookings.push({
          id,
          status,
          start: bookingStart,
          end: r.end,
          items: r.items,
        });
      if (bookings.length > 300)
        throw new Error(
          "활성 예약이 많습니다. 완료된 대여를 반납 처리해 주세요.",
        );
      tx.set(lockRef(db), {
        bookings: JSON.stringify(bookings),
        updatedAt: serverTimestamp(),
      });
    }
    tx.update(ref, {
      status,
      reason: reason.trim(),
      updatedAt: serverTimestamp(),
      [`history.${status}`]: serverTimestamp(),
    });
  });
  return { request: { id, status } };
}
export const markRead = () =>
  setDoc(
    doc(db, "users", auth.currentUser.uid),
    { readThrough: serverTimestamp() },
    { merge: true },
  );
export async function saveEquipment(item, context = { database: db }) {
  const { database: db } = context;
  const id = item.id || crypto.randomUUID();
  const data = {
    name: item.name.trim(),
    subtitle: item.subtitle.trim(),
    category: item.category,
    total: Number(item.total),
    image: {
      카메라: "fx3.png",
      렌즈: "lens.png",
      조명: "light.png",
      오디오: "mic.png",
    }[item.category],
  };
  if (
    !data.name ||
    data.name.length > 100 ||
    data.subtitle.length > 160 ||
    !Number.isInteger(data.total) ||
    data.total < 0 ||
    data.total > 100
  )
    throw new Error("장비명과 보유 수량(0~100)을 확인해 주세요.");
  await runTransaction(db, async (tx) => {
    const schedule = await tx.get(lockRef(db));
    const bookings = schedule.exists()
      ? JSON.parse(schedule.data().bookings)
      : [];
    const active = bookings.filter(
      (r) =>
        (r.status === "borrowed" || Date.parse(r.end) > Date.now()) &&
        r.items.some((i) => i.id === id),
    );
    if (active.length)
      throw new Error(
        "승인·대여 중인 예약이 있어요. 예약을 먼저 처리한 뒤 장비를 수정해 주세요.",
      );
    tx.set(doc(db, "catalog", id), data);
    tx.set(lockRef(db), {
      bookings: JSON.stringify(bookings),
      updatedAt: serverTimestamp(),
    });
  });
}
export function errorMessage(error) {
  const code = error?.code || "";
  if (code.includes("popup-closed"))
    return "로그인 창이 닫혔어요. 다시 로그인해 주세요.";
  if (code.includes("popup-blocked"))
    return "브라우저 팝업을 허용하고 다시 로그인해 주세요.";
  if (code.includes("permission-denied"))
    return "접근 권한이 없거나 입력 조건을 충족하지 못했어요. 계정과 입력 내용을 확인해 주세요.";
  if (code.includes("unavailable") || code.includes("network"))
    return "서버에 연결할 수 없어요. 인터넷 연결을 확인하고 다시 시도해 주세요.";
  if (code.includes("resource-exhausted"))
    return "무료 서비스 사용량 한도에 도달했어요. 담당자에게 문의해 주세요.";
  return error?.message || "처리하지 못했어요. 다시 시도해 주세요.";
}

// Visible, development-only fixture entry; never included in the production login flow.
export async function loginEmulator(role) {
  if (!emulatorMode) throw new Error("Local emulator only");
  const email =
    role === "admin" ? "yunseonglab@gmail.com" : `${role}@example.test`;
  const token = JSON.stringify({
    sub: role,
    email,
    email_verified: true,
    name: `테스트 ${role}`,
  });
  return signInWithCredential(auth, GoogleAuthProvider.credential(token));
}
