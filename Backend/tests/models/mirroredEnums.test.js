const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * The mirrored models must admit everything the app writes.
 *
 * ── Why this is a guard and not a comment ────────────────────────────────────
 *
 * Job, Transaction and JobPostingSettings are hand-duplicated: one MongoDB, two
 * Mongoose schemas, no shared package. Whenever the two drift, the failure is
 * always the same shape and always found by accident — a document the app writes
 * routinely cannot be saved by the admin, so an admin action throws a
 * ValidationError on a value it had no reason to care about.
 *
 * It has happened four times now:
 *   - `no_show_payout` missing from the admin's dispute `resolution` enum, so the
 *     ruling 500'd.
 *   - `escrow_release` missing from the server's `fromUserId` exemption list, so
 *     every scheduled payout failed validation.
 *   - `cancellation_fee` missing from the admin's Transaction `type`, directly
 *     under a comment saying it must stay in step.
 *   - `economy` missing from the admin's `serviceTier`, while jobs carrying it
 *     existed — so any admin save of one of those jobs failed. (That field has
 *     since been deleted outright as dead data; the incident is kept here
 *     because it is what motivated widening this guard to every mirrored
 *     pair, which is how two further drifts were found.)
 *
 * ── The invariant, and why it is one-directional ─────────────────────────────
 *
 * SERVER ⊆ ADMIN, per enum path. The app is the writer and the admin is the
 * reader-and-editor, so the admin must accept every value the app can produce.
 * The reverse is deliberately allowed: the admin's enums carry legacy values
 * ('basic', 'waived', 'xendit') that live rows may still hold and that removing
 * would start rejecting real data.
 *
 * That direction is what makes this an invariant rather than a list of blessed
 * exceptions — there is nothing to keep up to date when a new legacy value shows
 * up, and nothing that can be quietly allowlisted when a real drift appears.
 */

const SERVER_MODELS = path.resolve(
  __dirname,
  "../../../../kayod/server/src/models"
);
const ADMIN_MODELS = path.resolve(__dirname, "../../app/models");
// Every model file that exists under both trees. Enumerated rather than
// listed by hand so a newly duplicated model is covered the day it appears,
// which is the only point at which anyone would remember to add it.
const MIRRORED = fs
  .readdirSync(SERVER_MODELS)
  .filter((file) => file.endsWith(".js"))
  .map((file) => file.replace(/\.js$/, ""))
  .filter((model) => fs.existsSync(path.join(ADMIN_MODELS, `${model}.js`)));

/**
 * Enum value-sets keyed by their dotted schema path.
 *
 * Tracks brace nesting rather than guessing from the nearest preceding
 * identifier: `enum` declarations sit several levels deep (
 * `completionStatus.dispute.resolution`) and a heuristic that reads backwards
 * mislabels them, which would silently compare two unrelated enums and pass.
 */
function collectEnums(source) {
  const enums = new Map();
  const stack = [];
  let i = 0;

  while (i < source.length) {
    // Skip comments and strings so braces inside them never move the stack.
    if (source.startsWith("//", i)) {
      const end = source.indexOf("\n", i);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    const quote = source[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      i += 1;
      while (i < source.length && source[i] !== quote) {
        i += source[i] === "\\" ? 2 : 1;
      }
      i += 1;
      continue;
    }

    if (source[i] === "{") {
      const before = source.slice(Math.max(0, i - 120), i);
      const named = before.match(/([A-Za-z_$][\w$]*)\s*:\s*$/);
      stack.push(named ? named[1] : null);
      i += 1;
      continue;
    }
    if (source[i] === "}") {
      stack.pop();
      i += 1;
      continue;
    }

    const enumMatch = /^enum\s*:\s*\[/.exec(source.slice(i, i + 40));
    if (enumMatch) {
      const open = i + enumMatch[0].length - 1;
      const close = source.indexOf("]", open);
      if (close !== -1) {
        // Comments are stripped from the body before values are read. They
        // routinely contain apostrophes ("the server's enum"), and an
        // unstripped one pairs with the next real quote and swallows the value
        // after it — which is exactly how this parser first reported a drift
        // that did not exist.
        const body = source
          .slice(open + 1, close)
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*/g, "");
        const values = new Set(
          Array.from(body.matchAll(/["']([^"']+)["']/g), (m) => m[1])
        );
        const key = stack.filter(Boolean).join(".");
        if (key && values.size) {
          // Same path twice (an array-of-subdocs re-declaring a field) unions,
          // which keeps the subset check conservative.
          const existing = enums.get(key);
          enums.set(key, existing ? new Set([...existing, ...values]) : values);
        }
        i = close + 1;
        continue;
      }
    }

    i += 1;
  }

  return enums;
}

test("the parser finds real enum paths, so a passing subset check is not vacuous", () => {
  const source = fs.readFileSync(path.join(ADMIN_MODELS, "Job.js"), "utf8");
  const enums = collectEnums(source);

  // If the parser silently found nothing, every comparison below would pass.
  assert.ok(
    enums.size >= 5,
    `Expected several enums in the admin Job model, found ${enums.size}`
  );
  const status = enums.get("Job.status") || enums.get("status");
  assert.ok(
    status && status.size > 1,
    `Expected a multi-value job status enum, got ${status && [...status]}`
  );
});

for (const model of MIRRORED) {
  test(`${model}: every value the server writes is accepted by the admin`, () => {
    const serverPath = path.join(SERVER_MODELS, `${model}.js`);
    const adminPath = path.join(ADMIN_MODELS, `${model}.js`);
    assert.ok(fs.existsSync(serverPath), `missing ${serverPath}`);
    assert.ok(fs.existsSync(adminPath), `missing ${adminPath}`);

    const serverEnums = collectEnums(fs.readFileSync(serverPath, "utf8"));
    const adminEnums = collectEnums(fs.readFileSync(adminPath, "utf8"));

    const problems = [];
    let compared = 0;

    for (const [rawPath, serverValues] of serverEnums) {
      // The two files name their root schema variable differently, so compare
      // on the path below the root.
      const suffix = rawPath.split(".").slice(1).join(".") || rawPath;
      const adminValues =
        adminEnums.get(rawPath) ||
        [...adminEnums].find(
          ([candidate]) =>
            candidate === suffix ||
            candidate.split(".").slice(1).join(".") === suffix
        )?.[1];

      // A path the admin does not model at all is not drift — the admin simply
      // does not carry that field.
      if (!adminValues) continue;

      compared += 1;
      const missing = [...serverValues].filter((v) => !adminValues.has(v));
      if (missing.length) {
        problems.push(`${suffix}: admin rejects ${missing.join(", ")}`);
      }
    }

    // Vacuity protection, but only where a comparison was actually possible. An
    // admin model that declares no enums at all is MORE permissive than the
    // server, which satisfies the invariant — flagging it would be a false
    // positive. Zero overlap when both sides have enums is different: that means
    // the path matching failed and every check below would be silently empty.
    if (serverEnums.size > 0 && adminEnums.size > 0) {
      assert.ok(
        compared > 0,
        `${model}: both models declare enums but no paths lined up — the comparison would be vacuous`
      );
    }
    assert.deepEqual(
      problems,
      [],
      `${model} enum drift (server writes values the admin cannot save):\n  ${problems.join("\n  ")}`
    );
  });
}
