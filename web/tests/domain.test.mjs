import test from "node:test";
import assert from "node:assert/strict";
import {
  available,
  initialState,
  freshDraft,
  createRequest,
  transition,
  validateProfile,
  validateBooking,
  STORE_KEY,
  demoState,
} from "../src/domain.js";
const future = (days = 1, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const draft = (changes = {}) => ({
  ...freshDraft(),
  studentId: "20241852",
  name: "테스트학생",
  year: "3",
  course: "영상제작실습",
  professor: "테스트교수",
  start: future(1),
  end: future(2),
  location: "교내 스튜디오",
  purpose: "수업 과제",
  items: [{ id: "fx3", qty: 1 }],
  agreed: true,
  ...changes,
});
test("required profile validation catches missing values and invalid student IDs", () => {
  assert.equal(Object.keys(validateProfile(freshDraft())).length, 2);
  assert.ok(validateProfile(draft({ studentId: "abc123" })).studentId);
  assert.deepEqual(validateProfile(draft()), {});
});
test("booking rejects past/reversed dates, missing location, empty and invalid quantities", () => {
  assert.ok(validateBooking(draft({ start: future(-1) }), []).start);
  assert.ok(validateBooking(draft({ end: future(0) }), []).end);
  assert.ok(validateBooking(draft({ location: " " }), []).location);
  for (const items of [
    [],
    [{ id: "fx3", qty: 0 }],
    [{ id: "fx3", qty: 1.5 }],
    [{ id: "x", qty: 1 }],
    [
      { id: "fx3", qty: 1 },
      { id: "fx3", qty: 1 },
    ],
  ])
    assert.ok(validateBooking(draft({ items }), []).items);
});
test("submission stores request and a matching unread admin notification", () => {
  const { state, request } = createRequest(initialState(), draft());
  assert.equal(state.requests[0].status, "pending");
  assert.equal(state.notifications[0].requestId, request.id);
  assert.equal(state.notifications[0].audience, "admin");
  assert.equal(state.notifications[0].read, false);
  assert.equal(state.notifications.length, 1);
});
test("no submission or reservation without agreement", () => {
  const result = createRequest(initialState(), draft({ agreed: false }));
  assert.ok(result.errors.agreed);
  assert.equal(result.state, undefined);
});
test("pending bookings reserve stock; overlapping overbooking is rejected", () => {
  const { state } = createRequest(
    initialState(),
    draft({ items: [{ id: "fx3", qty: 3 }] }),
  );
  assert.equal(available("fx3", future(1), future(2), state.requests), 0);
  assert.ok(createRequest(state, draft()).errors.items);
  assert.equal(available("fx3", future(2), future(3), state.requests), 3);
});
test("non-overlapping reservations within a large window use peak occupancy", () => {
  const requests = [
    {
      ...draft({
        start: future(1),
        end: future(2),
        items: [{ id: "fx3", qty: 2 }],
      }),
      id: "a",
      status: "approved",
    },
    {
      ...draft({
        start: future(3),
        end: future(4),
        items: [{ id: "fx3", qty: 2 }],
      }),
      id: "b",
      status: "pending",
    },
  ];
  assert.equal(available("fx3", future(0), future(5), requests), 1);
});
test("approval excludes own reservation and sends student notification", () => {
  let { state, request } = createRequest(
    initialState(),
    draft({ items: [{ id: "fx3", qty: 3 }] }),
  );
  const r = transition(state, request.id, "approved");
  assert.equal(r.request.status, "approved");
  assert.equal(r.state.notifications[0].audience, "student");
  assert.equal(r.request.history.length, 2);
});
test("approved to borrowed to returned releases equipment and records history", () => {
  let { state, request } = createRequest(initialState(), draft());
  state = transition(state, request.id, "approved").state;
  state = transition(state, request.id, "borrowed").state;
  assert.equal(available("fx3", future(1), future(2), state.requests), 2);
  state = transition(state, request.id, "returned").state;
  assert.equal(available("fx3", future(1), future(2), state.requests), 3);
  assert.equal(state.requests[0].history.length, 4);
});
test("rejection requires reason and cancellation frees reserved stock", () => {
  let { state, request } = createRequest(initialState(), draft());
  assert.ok(transition(state, request.id, "rejected", " ").error);
  const rejected = transition(state, request.id, "rejected", "점검 중");
  assert.equal(rejected.request.reason, "점검 중");
  assert.equal(
    available("fx3", future(1), future(2), rejected.state.requests),
    3,
  );
  const cancelled = transition(state, request.id, "cancelled");
  assert.equal(cancelled.state.notifications[0].audience, "admin");
  assert.equal(
    available("fx3", future(1), future(2), cancelled.state.requests),
    3,
  );
});
test("invalid transitions, duplicate approvals and expired loans are rejected", () => {
  const { state, request } = createRequest(initialState(), draft());
  assert.ok(transition(state, request.id, "returned").error);
  const approved = transition(state, request.id, "approved");
  assert.ok(transition(approved.state, request.id, "approved").error);
  assert.ok(
    transition(state, request.id, "approved", "", Date.parse(future(4))).error,
  );
  assert.ok(transition(state, "missing", "approved").error);
});
test("overdue borrowed stock remains blocked until physical return", () => {
  const request = {
    ...draft({
      start: future(-3),
      end: future(-1),
      items: [{ id: "fx3", qty: 2 }],
    }),
    id: "overdue",
    status: "borrowed",
  };
  assert.equal(available("fx3", future(2), future(4), [request]), 1);
});
test("demo samples contain complete requests and consistent notification references", () => {
  const s = demoState();
  assert.equal(s.requests.length, 4);
  for (const n of s.notifications)
    assert.ok(s.requests.some((r) => r.id === n.requestId));
  assert.deepEqual(
    new Set(s.requests.map((r) => r.status)),
    new Set(["pending", "approved", "borrowed", "rejected"]),
  );
});
