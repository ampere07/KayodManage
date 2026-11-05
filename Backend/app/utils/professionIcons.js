/**
 * Profession icons as the Kayod app finds them: by NAME, at
 * professionIconsUpload/<slug>.webp on ImageKit, with ?updatedAt= so a
 * replaced icon isn't served from cache (kayod/client JobCard.jsx and
 * categoryVisualMapping.getProfessionVisuals).
 */

const IMAGEKIT_URL_ENDPOINT = (process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/9vpn8u272').replace(/\/+$/, '');

// Must stay in lockstep with the Kayod client's resolver and the admin
// frontend's generateProfessionIconFilename. If these diverge, the app asks
// for a filename the stored icon doesn't have and the icon 404s.
const iconSlug = (professionName) =>
  String(professionName || '')
    .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase → kebab (parity with Kayod client)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');

/** The exact URL the app loads for a profession's icon. */
const appIconUrl = (name, updatedAt) => {
  const ts = updatedAt ? new Date(updatedAt).getTime() : NaN;
  return `${IMAGEKIT_URL_ENDPOINT}/professionIconsUpload/${iconSlug(name)}.webp${Number.isFinite(ts) ? `?updatedAt=${ts}` : ''}`;
};

// url → { exists: true | false | null, at }. The URL carries ?updatedAt=, so a
// new upload is a new URL and is checked afresh; entries just expire.
const cache = new Map();
const TTL_MS = 10 * 60 * 1000;

/**
 * true: there; false: 404; null: couldn't tell (timeout, network, other
 * status). `problems` collects why, so a batch that can't reach ImageKit says
 * so once in the log instead of silently reporting every icon as unknown.
 */
const exists = async (url, fetchImpl, problems) => {
  try {
    const response = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (response.status === 200) return true;
    if (response.status === 404) return false;
    problems.push(`HTTP ${response.status}`);
    return null;
  } catch (error) {
    problems.push(error?.cause?.code || error?.cause?.message || error?.message || String(error));
    return null;
  }
};

/**
 * Whether each profession's icon is there, asked of ImageKit with a HEAD
 * request to the same public URL the app loads — no API keys needed, and the
 * admin's browser never requests a missing file (each one would log a 404).
 *
 * @param professions [{ _id, name, updatedAt }]
 * @returns [{ id, name, updatedAt, exists }] in the same order
 */
const checkIcons = async (professions, { fetchImpl = fetch, concurrency = 8, now = Date.now } = {}) => {
  const rows = professions.map((p) => ({ id: String(p._id), name: p.name, updatedAt: p.updatedAt || null, url: appIconUrl(p.name, p.updatedAt) }));
  const stale = (url) => {
    const hit = cache.get(url);
    return !hit || hit.exists === null || now() - hit.at > TTL_MS;
  };
  const todo = [...new Set(rows.map((r) => r.url))].filter(stale);
  const problems = [];
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const url = todo[next++];
      cache.set(url, { exists: await exists(url, fetchImpl, problems), at: now() });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  if (problems.length) {
    console.warn(`[ProfessionIcons] Couldn't check ${problems.length} of ${todo.length} icons: ${[...new Set(problems)].slice(0, 3).join('; ')}`);
  }
  return rows.map(({ id, name, updatedAt, url }) => ({ id, name, updatedAt, exists: cache.get(url)?.exists ?? null }));
};

/** For tests. */
const clearIconCache = () => cache.clear();

module.exports = { iconSlug, appIconUrl, checkIcons, clearIconCache, IMAGEKIT_URL_ENDPOINT };
