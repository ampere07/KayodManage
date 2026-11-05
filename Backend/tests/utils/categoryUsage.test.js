const test = require("node:test");
const assert = require("node:assert/strict");

const { tallyUsage, ACTIVE_JOB_STATUSES } = require("../../app/utils/categoryUsage");

/**
 * Settings → Configuration shows, beside every category and profession, how
 * many jobs and providers use it, so an admin knows what a rename, move or
 * delete touches. Jobs and provider profiles name professions by string, so a
 * miscount here means deleting something "unused" that people rely on.
 */

const categories = [
  { _id: "c1", name: "Home Repair", professions: [{ _id: "p1", name: "Plumber" }, { _id: "p2", name: "Electrician" }] },
  { _id: "c2", name: "Wellness", professions: [{ _id: "p3", name: "Massage Therapist" }] },
];

test("jobs are counted per profession and per category, active ones separately", () => {
  const usage = tallyUsage({
    categories,
    jobsByProfession: [{ _id: "Plumber", jobs: 5, active: 2 }, { _id: "Massage Therapist", jobs: 1, active: 0 }],
    jobsByCategory: [{ _id: "Home Repair", jobs: 7, active: 3 }],
  });
  assert.deepEqual(usage.professions.p1, { jobs: 5, activeJobs: 2, providers: 0 });
  assert.deepEqual(usage.professions.p2, { jobs: 0, activeJobs: 0, providers: 0 });
  assert.deepEqual(usage.categories.c1, { jobs: 7, activeJobs: 3, providers: 0 });
  assert.deepEqual(usage.categories.c2, { jobs: 0, activeJobs: 0, providers: 0 });
});

test("names match whatever their case or spacing, and split spellings add up", () => {
  const usage = tallyUsage({
    categories,
    jobsByProfession: [{ _id: "plumber", jobs: 2, active: 1 }, { _id: " PLUMBER ", jobs: 1, active: 1 }],
    jobsByCategory: [{ _id: "home repair", jobs: 3, active: 0 }],
    providers: [{ _id: "u1", categories: ["plumber"] }],
  });
  assert.deepEqual(usage.professions.p1, { jobs: 3, activeJobs: 2, providers: 1 });
  assert.equal(usage.categories.c1.jobs, 3);
});

test("a category's providers are counted once, however many of its professions they list", () => {
  const usage = tallyUsage({
    categories,
    providers: [
      { _id: "u1", categories: ["Plumber", "Electrician"], category: "Home Repair" },
      { _id: "u2", categories: ["Electrician"] },
      { _id: "u3", categories: [], category: "Home Repair" },
      { _id: "u4", categories: ["Massage Therapist"] },
    ],
  });
  assert.equal(usage.professions.p1.providers, 1);
  assert.equal(usage.professions.p2.providers, 2);
  assert.equal(usage.categories.c1.providers, 3, "u1, u2 and u3 — u1 only once");
  assert.equal(usage.categories.c2.providers, 1);
});

test("missing or empty inputs count as nothing rather than failing", () => {
  const usage = tallyUsage({ categories: [{ _id: "c9", name: "Empty" }], jobsByProfession: [{ _id: null, jobs: 4 }], providers: [{ _id: "u9" }] });
  assert.deepEqual(usage, { professions: {}, categories: { c9: { jobs: 0, activeJobs: 0, providers: 0 } } });
});

test("running jobs are open, scheduled or in progress", () => {
  assert.deepEqual([...ACTIVE_JOB_STATUSES].sort(), ["in_progress", "open", "scheduled"]);
});
