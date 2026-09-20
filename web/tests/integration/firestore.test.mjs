import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import {
  submitRequest,
  changeRequest,
  saveEquipment,
} from "../../src/cloud.js";
import { setCatalog, freshDraft } from "../../src/domain.js";
let env, a, b, admin, anon;
const claims = (email) => ({
  email,
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
});
const user = (uid, email) => ({ uid, email, emailVerified: true });
const au = user("alice", "alice@example.test"),
  bu = user("bob", "bob@example.test"),
  ad = user("admin", "yunseonglab@gmail.com");
const context = (database, user) => ({ database, user });
const item = {
  id: "camera",
  name: "테스트 카메라",
  subtitle: "에뮬레이터 전용",
  category: "카메라",
  total: 1,
  image: "fx3.png",
};
const draft = () => ({
  ...freshDraft(),
  studentId: "20241852",
  name: "테스트 학생",
  year: "3",
  course: "영상실습",
  professor: "담당교수",
  location: "스튜디오",
  purpose: "과제 촬영",
  items: [{ id: "camera", qty: 1 }],
  agreed: true,
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-equipment-loan",
    firestore: {
      host: "127.0.0.1",
      port: 8280,
      rules: await fs.readFile(
        new URL("../../../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
  await env.clearFirestore();
  a = env.authenticatedContext("alice", claims(au.email)).firestore();
  b = env.authenticatedContext("bob", claims(bu.email)).firestore();
  admin = env.authenticatedContext("admin", claims(ad.email)).firestore();
  anon = env.unauthenticatedContext().firestore();
  setCatalog([item]);
  await saveEquipment(item, context(admin, ad));
});
after(async () => {
  await env?.cleanup();
});
test("private queries and public-list exploit are denied; catalog needs Google login", async () => {
  await assertFails(getDocs(collection(anon, "requests")));
  await assertFails(getDocs(collection(anon, "catalog")));
  await assertSucceeds(getDocs(collection(a, "catalog")));
});
test("actual submit implementation stores own request, admin receives realtime change", async () => {
  let stop;
  const observed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("listener timed out")), 7000);
    stop = onSnapshot(
      query(
        collection(admin, "requests"),
        orderBy("createdAt", "desc"),
        limit(300),
      ),
      (s) => {
        if (s.docs.some((d) => d.id === "request-a")) {
          clearTimeout(timer);
          resolve();
        }
      },
      reject,
    );
  });
  await submitRequest(draft(), [], "request-a", context(a, au));
  await observed;
  stop();
  assert.equal(
    (await getDoc(doc(admin, "requests", "request-a"))).data().uid,
    "alice",
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(a, "requests"),
        where("uid", "==", "alice"),
        orderBy("createdAt", "desc"),
        limit(100),
      ),
    ),
  );
  await assertFails(getDoc(doc(b, "requests", "request-a")));
  await assertFails(getDocs(collection(a, "requests")));
  await assertFails(getDoc(doc(b, "users", "alice")));
});
test("throttle and duplicate request id are enforced", async () => {
  await submitRequest(draft(), [], "request-a", context(a, au));
  await assert.rejects(
    submitRequest(draft(), [], "request-a2", context(a, au)),
    /잠시/,
  );
  assert.equal((await getDocs(collection(admin, "requests"))).size, 1);
});
test("student cannot approve, reassign ownership, change timestamps or pollute schema", async () => {
  const ref = doc(a, "requests", "request-a");
  for (const patch of [
    { status: "approved" },
    { uid: "bob" },
    { createdAt: serverTimestamp() },
    { extra: "injected" },
    { name: "x".repeat(10000) },
    { studentId: 1234 },
    { items: [{ id: "camera", qty: -1 }] },
    { status: "returned" },
  ])
    await assertFails(
      updateDoc(ref, { ...patch, updatedAt: serverTimestamp() }),
    );
  await assertFails(deleteDoc(ref));
  await assertFails(
    setDoc(doc(a, "users", "alice"), { isAdmin: true }, { merge: true }),
  );
  await assertFails(setDoc(doc(a, "catalog", "hijack"), { ...item }));
  await assertFails(
    setDoc(doc(a, "system", "schedule"), {
      bookings: "[]",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(a, "users", "alice", "private", "orphan"), { text: "bad" }),
  );
});
test("create validators reject spoofing, invalid types, missing fields, long strings and quantities", async () => {
  const original = (await getDoc(doc(admin, "requests", "request-a"))).data();
  let n = 0;
  for (const change of [
    { uid: "alice" },
    { name: "x".repeat(61) },
    { name: 1 },
    { professor: "" },
    { start: 0 },
    { end: 0 },
    { items: [{ id: "camera", qty: -1 }] },
    { items: [{ id: "camera", qty: 1000 }] },
    {
      items: [
        { id: "camera", qty: 1 },
        { id: "camera", qty: 1 },
      ],
    },
    { items: [{ id: "../private", qty: 1 }] },
    { items: Array(100).fill({ id: "camera", qty: 1 }) },
    { status: "approved" },
    { extra: true },
    { history: { approved: Timestamp.now() } },
    { createdAt: Timestamp.fromMillis(0) },
  ]) {
    const id = `attack-${n++}`,
      data = {
        ...original,
        uid: "bob",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        history: { pending: serverTimestamp() },
        ...change,
      };
    const batch = writeBatch(b);
    batch.set(doc(b, "requests", id), data);
    batch.set(
      doc(b, "users", "bob"),
      { lastSubmit: serverTimestamp(), lastRequestId: id },
      { merge: true },
    );
    await assertFails(batch.commit());
  }
  const id = "missing";
  const data = {
    ...original,
    uid: "bob",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    history: { pending: serverTimestamp() },
  };
  delete data.name;
  const batch = writeBatch(b);
  batch.set(doc(b, "requests", id), data);
  batch.set(
    doc(b, "users", "bob"),
    { lastSubmit: serverTimestamp(), lastRequestId: id },
    { merge: true },
  );
  await assertFails(batch.commit());
});
test("unverified admin email and non-Google provider cannot gain admin access", async () => {
  const unverified = env
    .authenticatedContext("fake", {
      ...claims(ad.email),
      email_verified: false,
    })
    .firestore();
  const password = env
    .authenticatedContext("fake2", {
      ...claims(ad.email),
      firebase: { sign_in_provider: "password" },
    })
    .firestore();
  await assertFails(getDocs(collection(unverified, "requests")));
  await assertFails(getDocs(collection(password, "requests")));
});
test("two concurrent approvals use transaction-fresh stock: only one wins", async () => {
  await submitRequest(draft(), [], "request-b", context(b, bu));
  const results = await Promise.allSettled([
    changeRequest("request-a", "approved", "", context(admin, ad)),
    changeRequest("request-b", "approved", "", context(admin, ad)),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const bookings = JSON.parse(
    (await getDoc(doc(admin, "system", "schedule"))).data().bookings,
  );
  assert.equal(bookings.length, 1);
  assert.equal(bookings[0].items[0].qty, 1);
  assert.equal(Object.hasOwn(bookings[0], "name"), false);
  assert.equal(Object.hasOwn(bookings[0], "uid"), false);
  const winner = bookings[0].id,
    loser = winner === "request-a" ? "request-b" : "request-a";
  await assert.rejects(
    saveEquipment({ ...item, total: 2 }, context(admin, ad)),
    /예약/,
  );
  await changeRequest(winner, "borrowed", "", context(admin, ad));
  await assert.rejects(
    changeRequest(loser, "approved", "", context(admin, ad)),
    /수량/,
  );
  await changeRequest(winner, "returned", "", context(admin, ad));
  await changeRequest(loser, "approved", "", context(admin, ad));
  assert.equal(
    (await getDoc(doc(admin, "requests", winner))).data().status,
    "returned",
  );
  await assertFails(
    updateDoc(doc(a, "requests", winner), {
      status: "pending",
      updatedAt: serverTimestamp(),
    }),
  );
});
test("own pending cancellation is allowed; other student cancellation and approval cancellation denied", async () => {
  const cUser = user("charlie", "charlie@example.test"),
    c = env.authenticatedContext(cUser.uid, claims(cUser.email)).firestore();
  await submitRequest(draft(), [], "request-c", context(c, cUser));
  await assert.rejects(
    changeRequest("request-c", "cancelled", "", context(b, bu)),
  );
  await changeRequest("request-c", "cancelled", "", context(c, cUser));
  assert.equal(
    (await getDoc(doc(admin, "requests", "request-c"))).data().status,
    "cancelled",
  );
  await assertFails(
    updateDoc(doc(c, "users", "charlie"), {
      lastSubmit: serverTimestamp(),
      lastRequestId: "request-c",
    }),
  );
});
