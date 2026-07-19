const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Job = require("../../app/models/Job");

function buildJob(startNavigation) {
  return new Job({
    title: "Arrival compatibility",
    description: "Admin resolution must save jobs after provider arrival.",
    category: "cleaning",
    userId: new mongoose.Types.ObjectId(),
    startNavigation,
  });
}

test('accepts Kayod\'s "arrived" navigation state', () => {
  const job = buildJob("arrived");
  const validationError = job.validateSync();

  assert.equal(validationError?.errors?.startNavigation, undefined);
  assert.equal(job.startNavigation, "arrived");
});

test("continues to accept legacy boolean navigation states", () => {
  const navigatingJob = buildJob(true);
  const idleJob = buildJob(false);

  assert.equal(navigatingJob.validateSync(), undefined);
  assert.equal(idleJob.validateSync(), undefined);
});
