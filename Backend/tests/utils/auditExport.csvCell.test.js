const test = require("node:test");
const assert = require("node:assert/strict");

const { _csvCell: csvCell } = require("../../app/controllers/activityLogController");

/**
 * Audit log exports carry user-entered text (names, job titles, report
 * comments). Opened in a spreadsheet, a cell starting with = + - or @ runs as a
 * formula, so the export must neutralise those and quote everything safely.
 */

test("plain text is quoted as-is", () => {
  assert.equal(csvCell("Banned user Juan Santos for 7 days"), '"Banned user Juan Santos for 7 days"');
});

test("embedded quotes are doubled and commas stay inside the cell", () => {
  assert.equal(csvCell('Deleted ad "Promo, final"'), '"Deleted ad ""Promo, final"""');
});

test("formula-looking cells open as text", () => {
  for (const value of ['=HYPERLINK("http://x")', "+1+1", "-2+3", "@SUM(A1)"]) {
    assert.ok(csvCell(value).startsWith(`"'`), `${value} should be prefixed`);
  }
});

test("empty values are empty cells", () => {
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
});
