const test = require("node:test");
const assert = require("node:assert/strict");

const { iconSlug, appIconUrl, checkIcons, clearIconCache } = require("../../app/utils/professionIcons");

/**
 * The admin page asks the backend which profession icons exist, using the URL
 * the Kayod app itself loads. If the slug or URL drifts from the app's, the
 * page reports icons as present (or missing) when clients see the opposite.
 */

const fakeFetch = (statusByFile, calls = []) => async (url, options) => {
  calls.push({ url, method: options?.method });
  const file = new URL(url).pathname.split("/").pop();
  if (statusByFile[file] === "throw") throw new Error("network down");
  return { status: statusByFile[file] ?? 404 };
};

test("the slug is the app's: camelCase split, spaces to hyphens, symbols dropped", () => {
  assert.equal(iconSlug("AutoMechanic"), "auto-mechanic");
  assert.equal(iconSlug("Hair & Nails"), "hair-nails");
  assert.equal(iconSlug("  CCTV Installation "), "cctv-installation");
  assert.equal(iconSlug(undefined), "");
});

test("the URL is the one the app loads, cache-busted by updatedAt", () => {
  assert.equal(
    appIconUrl("CCTV Installation", "2026-10-19T00:00:00.000Z"),
    `https://ik.imagekit.io/9vpn8u272/professionIconsUpload/cctv-installation.webp?updatedAt=${Date.parse("2026-10-19T00:00:00.000Z")}`
  );
  assert.equal(appIconUrl("Plumbing"), "https://ik.imagekit.io/9vpn8u272/professionIconsUpload/plumbing.webp");
});

test("200 is there, 404 is missing, anything else is unknown — with HEAD requests only", async () => {
  clearIconCache();
  const calls = [];
  const icons = await checkIcons(
    [
      { _id: "a", name: "Plumbing", updatedAt: "2026-01-01" },
      { _id: "b", name: "CCTV Installation", updatedAt: "2026-01-01" },
      { _id: "c", name: "Laundry", updatedAt: "2026-01-01" },
      { _id: "d", name: "Massage", updatedAt: "2026-01-01" },
    ],
    { fetchImpl: fakeFetch({ "plumbing.webp": 200, "laundry.webp": 503, "massage.webp": "throw" }, calls) }
  );
  assert.deepEqual(icons.map((i) => [i.id, i.exists]), [["a", true], ["b", false], ["c", null], ["d", null]]);
  assert.ok(calls.every((c) => c.method === "HEAD"));
});

test("answers are cached, but a new updatedAt (a new upload) is checked again", async () => {
  clearIconCache();
  const calls = [];
  const fetchImpl = fakeFetch({ "plumbing.webp": 200 }, calls);
  await checkIcons([{ _id: "a", name: "Plumbing", updatedAt: "2026-01-01" }], { fetchImpl });
  await checkIcons([{ _id: "a", name: "Plumbing", updatedAt: "2026-01-01" }], { fetchImpl });
  assert.equal(calls.length, 1, "the second look is served from the cache");
  await checkIcons([{ _id: "a", name: "Plumbing", updatedAt: "2026-02-01" }], { fetchImpl });
  assert.equal(calls.length, 2);
});

test("an unknown answer is not trusted on the next look", async () => {
  clearIconCache();
  const calls = [];
  const fetchImpl = fakeFetch({ "plumbing.webp": "throw" }, calls);
  await checkIcons([{ _id: "a", name: "Plumbing", updatedAt: "2026-01-01" }], { fetchImpl });
  await checkIcons([{ _id: "a", name: "Plumbing", updatedAt: "2026-01-01" }], { fetchImpl });
  assert.equal(calls.length, 2);
});

test("cached answers expire", async () => {
  clearIconCache();
  const calls = [];
  let clock = 1_000_000;
  const options = { fetchImpl: fakeFetch({ "plumbing.webp": 200 }, calls), now: () => clock };
  await checkIcons([{ _id: "a", name: "Plumbing", updatedAt: "2026-01-01" }], options);
  clock += 11 * 60 * 1000;
  await checkIcons([{ _id: "a", name: "Plumbing", updatedAt: "2026-01-01" }], options);
  assert.equal(calls.length, 2);
});
