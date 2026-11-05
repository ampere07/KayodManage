/**
 * How much each job category and profession is in use: jobs (all, and the ones
 * still running) and the providers who list it on their profile.
 *
 * Jobs and provider profiles name professions and categories by NAME —
 * kayod/server writes `professionName` and `category` as plain strings, and a
 * provider's `categories` holds the names of the professions they offer — so
 * everything is matched by name, ignoring case and surrounding spaces.
 */

const key = (value) => String(value || '').trim().toLowerCase();

/** Group counts can arrive split by spelling ("Plumber", "plumber "); add them up. */
const sumByName = (groups) => {
  const totals = new Map();
  for (const group of groups || []) {
    const k = key(group._id);
    if (!k) continue;
    const prev = totals.get(k) || { jobs: 0, active: 0 };
    totals.set(k, { jobs: prev.jobs + (group.jobs || 0), active: prev.active + (group.active || 0) });
  }
  return totals;
};

const addTo = (map, k, id) => {
  if (!k) return;
  if (!map.has(k)) map.set(k, new Set());
  map.get(k).add(id);
};

/**
 * @param categories       [{ _id, name, professions: [{ _id, name }] }]
 * @param jobsByProfession [{ _id: professionName, jobs, active }]
 * @param jobsByCategory   [{ _id: categoryName, jobs, active }]
 * @param providers        [{ _id, categories: [professionName], category: categoryName }]
 * @returns {{ professions: Record<id, Usage>, categories: Record<id, Usage> }}
 *   where Usage is { jobs, activeJobs, providers }. A category's providers are
 *   counted once each, however many of its professions they list.
 */
const tallyUsage = ({ categories = [], jobsByProfession = [], jobsByCategory = [], providers = [] }) => {
  const professionJobs = sumByName(jobsByProfession);
  const categoryJobs = sumByName(jobsByCategory);

  const providersByProfession = new Map();
  const providersByCategory = new Map();
  for (const provider of providers) {
    const id = String(provider._id);
    for (const name of provider.categories || []) addTo(providersByProfession, key(name), id);
    addTo(providersByCategory, key(provider.category), id);
  }

  const none = { jobs: 0, active: 0 };
  const professions = {};
  const categoryUsage = {};
  for (const category of categories) {
    const offering = new Set(providersByCategory.get(key(category.name)) || []);
    for (const profession of category.professions || []) {
      const ids = providersByProfession.get(key(profession.name)) || new Set();
      ids.forEach((id) => offering.add(id));
      const jobs = professionJobs.get(key(profession.name)) || none;
      professions[String(profession._id)] = { jobs: jobs.jobs, activeJobs: jobs.active, providers: ids.size };
    }
    const jobs = categoryJobs.get(key(category.name)) || none;
    categoryUsage[String(category._id)] = { jobs: jobs.jobs, activeJobs: jobs.active, providers: offering.size };
  }
  return { professions, categories: categoryUsage };
};

/** Statuses of a job that is still running. */
const ACTIVE_JOB_STATUSES = ['open', 'scheduled', 'in_progress'];

module.exports = { tallyUsage, ACTIVE_JOB_STATUSES };
