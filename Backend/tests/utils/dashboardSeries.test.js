const test = require("node:test");
const assert = require("node:assert/strict");

const { dayKey, startOfDay, lastDays, lastMonths, fillSeries, rollUpMonths } = require("../../app/utils/dashboardSeries");

/**
 * The Dashboard counts days in Manila time. At 11 PM UTC it is already the next
 * morning in Manila, so a server in UTC must not file that moment under the
 * UTC date, and "today" must start at Manila midnight.
 */

test("a late-evening UTC moment belongs to the next Manila day", () => {
  const moment = new Date("2026-10-16T23:30:00Z"); // 07:30 on Oct 17 in Manila
  assert.equal(dayKey(moment, "Asia/Manila"), "2026-10-17");
  assert.equal(dayKey(moment, "UTC"), "2026-10-16");
});

test("today starts at Manila midnight, 16:00 UTC the day before", () => {
  const moment = new Date("2026-10-17T03:00:00Z");
  assert.equal(startOfDay(moment, "Asia/Manila").toISOString(), "2026-10-16T16:00:00.000Z");
  assert.equal(startOfDay(moment, "UTC").toISOString(), "2026-10-17T00:00:00.000Z");
});

test("lastDays lists consecutive days, oldest first, ending today", () => {
  const days = lastDays(3, new Date("2026-03-01T03:00:00Z"), "Asia/Manila");
  assert.deepEqual(days, ["2026-02-27", "2026-02-28", "2026-03-01"]);
});

test("lastDays stays one key per date across a daylight-saving change", () => {
  // New York moves its clocks forward on 2026-03-08.
  const days = lastDays(4, new Date("2026-03-09T15:00:00Z"), "America/New_York");
  assert.deepEqual(days, ["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09"]);
});

test("lastMonths crosses the year boundary", () => {
  assert.deepEqual(lastMonths(3, new Date("2026-01-10T03:00:00Z"), "Asia/Manila"), ["2025-11", "2025-12", "2026-01"]);
});

test("fillSeries puts zero where a day had no rows", () => {
  const filled = fillSeries(["2026-10-15", "2026-10-16"], [{ _id: "2026-10-16", fees: 40 }], ["fees", "jobValue"]);
  assert.deepEqual(filled, [
    { key: "2026-10-15", fees: 0, jobValue: 0 },
    { key: "2026-10-16", fees: 40, jobValue: 0 },
  ]);
});

test("rollUpMonths adds daily rows from different sources into one month", () => {
  const months = rollUpMonths([
    { _id: "2026-10-01", fees: 40, feeCount: 1 },
    { _id: "2026-10-05", jobValue: 400, jobsCompleted: 1 },
    { _id: "2026-09-30", fees: 10, feeCount: 1 },
  ]);
  const october = months.find((m) => m._id === "2026-10");
  assert.deepEqual(october, { _id: "2026-10", fees: 40, feeCount: 1, jobValue: 400, jobsCompleted: 1 });
  assert.equal(months.find((m) => m._id === "2026-09").fees, 10);
});
