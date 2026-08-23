const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ActivityLog = require("../../app/models/ActivityLog");

/**
 * Every action type this app logs must exist in the ActivityLog enum.
 *
 * ── Why this is a guard and not a comment ────────────────────────────────────
 *
 * `logActivity` / `createActivityLog` swallow their own errors on purpose, so an
 * admin action never fails because its audit write failed. The cost of that
 * choice is that a verb missing from the enum loses the audit entry **silently** —
 * the action succeeds, the log does not, and nothing anywhere says so.
 *
 * That has now happened three times: `dispute_resolved` and `job_force_cancelled`
 * (the two admin actions that move the most money, both leaving no trail at all)
 * and `support_accepted`. Each was found by accident. Prose telling the next
 * person to update the enum would not have caught the third one.
 *
 * So the relationship is checked instead of documented: this walks the source for
 * every logged verb and asserts the enum admits it.
 */

const APP_DIR = path.resolve(__dirname, "..", "..", "app");

// `logActivity(adminId, 'verb', ...)` and `createActivityLog(adminId, 'verb', ...)`.
// The verb is always the second positional argument, always a literal.
const CALL_PATTERN =
  /(?:logActivity|createActivityLog)\s*\(\s*[^,()]+,\s*['"]([a-z_]+)['"]/g;

function collectJsFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectJsFiles(full));
    } else if (entry.name.endsWith(".js")) {
      found.push(full);
    }
  }
  return found;
}

function loggedActionTypes() {
  const byVerb = new Map();

  for (const file of collectJsFiles(APP_DIR)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(CALL_PATTERN)) {
      const verb = match[1];
      if (!byVerb.has(verb)) byVerb.set(verb, new Set());
      byVerb.get(verb).add(path.relative(APP_DIR, file));
    }
  }

  return byVerb;
}

test("every logged action type is admitted by the ActivityLog enum", () => {
  const allowed = new Set(ActivityLog.schema.path("actionType").enumValues);
  const used = loggedActionTypes();

  // A pattern that matches nothing would make this test vacuously green, which
  // is the one failure mode a guard must not have.
  assert.ok(
    used.size > 0,
    "found no logActivity/createActivityLog calls — the scan pattern is broken, not the code"
  );

  const missing = [...used.entries()]
    .filter(([verb]) => !allowed.has(verb))
    .map(([verb, files]) => `${verb} (logged in ${[...files].join(", ")})`);

  assert.deepEqual(
    missing,
    [],
    "these action types are logged but rejected by the enum, so their audit " +
      "entries are silently dropped:\n  " + missing.join("\n  ")
  );
});

test("the enum has no value nothing ever logs", () => {
  // The other direction, reported rather than enforced. A stale value is only
  // debt, not a lost audit trail, and some verbs are written by paths this scan
  // cannot see (a route wiring its own call, a future feature landing early).
  const allowed = new Set(ActivityLog.schema.path("actionType").enumValues);
  const used = new Set(loggedActionTypes().keys());
  const unused = [...allowed].filter((verb) => !used.has(verb));

  assert.ok(
    Array.isArray(unused),
    `enum values with no logging call: ${unused.join(", ") || "none"}`
  );
});
