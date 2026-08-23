const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * The admin must never persist a User document with `.save()`.
 *
 * ── Why this is a guard and not a comment ────────────────────────────────────
 *
 * `.save()` validates the WHOLE document. This app's User schema requires
 * `email`, `phone` and `location`; the Kayod app signs people up by phone and
 * stores it as `phoneNumber`, so an app-created user has none of those three.
 * Any `.save()` on one therefore throws
 *
 *     User validation failed: phone: Path `phone` is required., email: ...
 *
 * ...for a change that had nothing to do with those fields.
 *
 * That is not hypothetical. `restrictForDisputeAbuse` did exactly this, and the
 * effect was that the automated repeat-dispute restriction **never applied to a
 * real user** — the write threw, the ruling still succeeded, and nothing
 * surfaced it. The manual enforcement path in services/userService.js was
 * unaffected only because it has always used `findByIdAndUpdate`, which
 * validates the updated paths rather than the whole document.
 *
 * So the rule is: reach for an atomic update on users. It sidesteps the
 * cross-schema required-field mismatch entirely, and it makes
 * check-then-write a single operation instead of a race.
 *
 * The mismatch itself is left in place deliberately: those fields ARE required
 * of users the admin creates, and relaxing the schema to make `.save()` safe
 * would weaken validation everywhere to accommodate one call site that should
 * not have existed.
 */

const APP_DIR = path.resolve(__dirname, "../../app");

/** Variable names that hold a User document in this codebase. */
const USER_DOC = /\b(user|targetUser|foundUser|existingUser|userDoc|raiser)\.save\s*\(/;

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

test("the scanner recognises the pattern it is looking for", () => {
  // Without this, a broken regex would make the real check below pass on
  // everything — the failure mode a guard can least afford.
  assert.match("await user.save({ session });", USER_DOC);
  assert.match("await existingUser.save();", USER_DOC);
  assert.doesNotMatch("await job.save({ session });", USER_DOC);
  assert.doesNotMatch("await User.findByIdAndUpdate(id, data);", USER_DOC);
});

test("no admin code persists a User document with .save()", () => {
  const files = walk(APP_DIR);
  assert.ok(files.length > 20, `expected to scan the app tree, found ${files.length} files`);

  const offenders = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    source.split(/\r?\n/).forEach((line, index) => {
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
      if (USER_DOC.test(line)) {
        offenders.push(`${path.relative(APP_DIR, file)}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    "User documents must be written with an atomic update, not .save():\n  " +
      offenders.join("\n  ")
  );
});
