const mongoose = require('mongoose');

// Global job-posting rules for the marketplace. This is a SINGLETON collection:
// only one document (key: 'job-posting') is ever created. Use the static
// getSettings() accessor rather than querying directly so defaults are seeded
// on first read.
const jobPostingSettingsSchema = new mongoose.Schema({
  // Singleton guard — enforces that only one settings document exists.
  key: {
    type: String,
    default: 'job-posting',
    unique: true,
  },
  // Maximum number of simultaneously active jobs a single user may have posted.
  maxActiveJobsPerUser: {
    type: Number,
    default: 5,
    min: 1,
  },
  // Number of days a job post stays live before it auto-expires.
  jobPostDurationDays: {
    type: Number,
    default: 30,
    min: 1,
  },
  // Priority fee (PHP) charged to the client when posting an ASAP job.
  // Read by the Kayod server (jobController) when charging the priority fee.
  asapFee: {
    type: Number,
    default: 100,
    min: 0,
  },
  // Booking fee model, based on the agreed price at booking:
  //  - agreedPrice >= bookingFeeThreshold -> fee = agreedPrice * (bookingFeePercentage / 100)
  //  - agreedPrice <  bookingFeeThreshold -> fee = bookingFeeMinimum (flat)
  // Defaults are 0 (fee disabled / opt-in) so no fee is charged until an admin
  // sets a percentage or a minimum — this avoids surprise charges on upgrade.
  bookingFeePercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  // Budget (PHP) at or above which the percentage fee is applied.
  bookingFeeThreshold: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Flat booking fee (PHP) charged when a job's budget is below the threshold.
  bookingFeeMinimum: {
    type: Number,
    default: 0,
    min: 0,
  },
  // --- Cancellation ---
  // Client cancellation fee: a percentage of the agreed price, floored at a
  // minimum, capped at the agreed price. Defaults preserve current behavior
  // (10% / ₱150). Read by the Kayod server's cancellationFee util.
  clientCancellationFeePercentage: {
    type: Number,
    default: 10,
    min: 0,
    max: 100,
  },
  clientCancellationFeeMinimum: {
    type: Number,
    default: 150,
    min: 0,
  },
  // Provider cancellation strike effect: the provider is restricted (blocked
  // from accepting jobs) once their strike count reaches this limit. Default 4.
  providerStrikeLimit: {
    type: Number,
    default: 4,
    min: 1,
  },
  // Rating points deducted per cancellation strike. 0 keeps the default
  // escalating penalties (0.3 / 0.5 / 0.7…); any value > 0 applies that flat
  // penalty per strike instead.
  providerStrikeRatingPenalty: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  // When true, a newly posted job must be approved by an admin before going live.
  requireApproval: {
    type: Boolean,
    default: false,
  },
  // When true, clients may attach images to a job post.
  allowAttachments: {
    type: Boolean,
    default: true,
  },
  // Maximum number of image attachments allowed per job post.
  maxAttachments: {
    type: Number,
    default: 5,
    min: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // uid/email of the admin who last saved the settings.
  updatedBy: {
    type: String,
    trim: true,
  },
});

jobPostingSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Returns the singleton settings document, seeding defaults on first access.
jobPostingSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: 'job-posting' });
  if (!settings) {
    settings = await this.create({ key: 'job-posting' });
  }
  return settings;
};

module.exports = mongoose.model('JobPostingSettings', jobPostingSettingsSchema, 'jobpostingsettings');
