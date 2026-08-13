/**
 * serviceClasses.js — admin-side mirror of the Kayod server's canonical
 * registry at kayod/server/src/config/serviceClasses.js. Read that file for the
 * full rationale; the short version:
 *
 *   A job category belongs to a service class, and the class decides how long
 *   the client's payment is held after completion before the provider is paid.
 *   `standard` (120h) is the warranty window for work that can fail later;
 *   `immediate` (24h) is for work consumed on the spot, where the only thing
 *   worth covering is a missed appointment.
 *
 * KayodManage owns the *write* path — this is where an admin assigns a class to
 * a category or overrides it on a single profession — so the validation here is
 * what keeps an unknown class out of the shared database in the first place.
 *
 * Keep in sync with the canonical file by hand. Same arrangement as
 * app/models/JobCategory.js, which is likewise duplicated across the two
 * backends because they share one database but not one package.
 */

const SERVICE_CLASS = {
  STANDARD: 'standard',
  IMMEDIATE: 'immediate',
};

const DEFAULT_SERVICE_CLASS = SERVICE_CLASS.STANDARD;

const SERVICE_CLASSES = {
  [SERVICE_CLASS.STANDARD]: {
    id: SERVICE_CLASS.STANDARD,
    label: 'Standard Service',
    description:
      'Work that can develop faults after it is finished — repairs, installations, construction. Payment is held as a warranty.',
    paymentReleaseHours: 120, // 5 days
  },
  [SERVICE_CLASS.IMMEDIATE]: {
    id: SERVICE_CLASS.IMMEDIATE,
    label: 'Immediate Service',
    description:
      'Work that is delivered and judged on the spot — wellness, grooming, personal care. Payment is released as soon as both sides confirm the job is complete.',
    // Zero on purpose, mirroring kayod/server/src/config/serviceClasses.js. The
    // client's protection is not an escrow hold, it is the 24-hour
    // auto-confirmation window that runs BEFORE completion is final. Holding for
    // another 24 hours after that stacked two windows into 48 hours of exposure
    // for a service the client had already signed off on.
    //
    // This mirror lagged that change and still wrote 24, which meant a job
    // touched by the admin backend settled on different terms than the same job
    // created through the app.
    paymentReleaseHours: 0,
  },
};

const SERVICE_CLASS_IDS = Object.keys(SERVICE_CLASSES);

const isServiceClass = (value) =>
  typeof value === 'string' && Object.hasOwn(SERVICE_CLASSES, value);

/** Unknown/missing always falls back to `standard` — never shorten a hold by accident. */
const normalizeServiceClass = (value) =>
  isServiceClass(value) ? value : DEFAULT_SERVICE_CLASS;

const getServiceClass = (value) => SERVICE_CLASSES[normalizeServiceClass(value)];

const getPaymentReleaseHours = (value) =>
  getServiceClass(value).paymentReleaseHours;

/**
 * Resolve the class that applies to a job: profession override → category
 * default → `standard`.
 */
function resolveServiceClass(category, professionName = null) {
  if (!category) return DEFAULT_SERVICE_CLASS;

  if (professionName) {
    const wanted = String(professionName).trim().toLowerCase();
    const profession = (category.professions || []).find(
      (entry) => String(entry?.name || '').trim().toLowerCase() === wanted
    );
    if (profession && isServiceClass(profession.serviceClass)) {
      return profession.serviceClass;
    }
  }

  return normalizeServiceClass(category.serviceClass);
}

module.exports = {
  SERVICE_CLASS,
  SERVICE_CLASSES,
  SERVICE_CLASS_IDS,
  DEFAULT_SERVICE_CLASS,
  isServiceClass,
  normalizeServiceClass,
  getServiceClass,
  getPaymentReleaseHours,
  resolveServiceClass,
};
