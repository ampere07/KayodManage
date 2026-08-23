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
  // Agreed price above which the percentage fee applies instead of the flat
  // minimum. 0 means "not configured", in which case the Kayod server uses the
  // active tier's own minimum as the threshold. Was read by the server but had
  // no field here, so it could never actually be set.
  clientCancellationFeeThreshold: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Day-of tier. A cancellation on or after the confirmed booking day costs
  // more, because the provider has already lost the day and cannot refill the
  // slot. Same percentage/minimum shape as the advance tier above, so there is
  // one fee model to reason about rather than two.
  clientCancellationDayOfFeePercentage: {
    type: Number,
    default: 20,
    min: 0,
    max: 100,
  },
  clientCancellationDayOfFeeMinimum: {
    type: Number,
    default: 300,
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
  // --- No-show review ---
  // A booking whose day passes with neither party confirming completion enters
  // a review window: both sides are notified and both can raise an issue. If
  // nobody does, the booking lapses and the client is refunded IN FULL, with no
  // fee, payout, or strike for either side — silence from both parties is not
  // evidence about either of them. See kayod/server NoShowReviewService.
  //
  // Total hours from the booking day ending to that automatic refund.
  noShowReviewWindowHours: {
    type: Number,
    default: 48,
    min: 1,
  },
  // Hours into the window at which the single "N hours left" reminder fires.
  noShowReviewReminderHours: {
    type: Number,
    default: 24,
    min: 0,
  },
  // Reserved-time payout: what an ADJUDICATED no-show pays the provider when an
  // admin finds the client did not appear. Never applied automatically.
  noShowPayoutPercentage: {
    type: Number,
    default: 20,
    min: 0,
    max: 100,
  },
  noShowPayoutMinimum: {
    type: Number,
    default: 300,
    min: 0,
  },
  // How long that payout is held before reaching the provider's available
  // balance. 0 means "use the job's own release window", so an immediate-class
  // job does not pay out the instant an admin clicks.
  noShowPayoutHoldHours: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Unclaimed lapses within 30 days before an account is restricted
  // automatically. A single lapse never restricts anyone; a pattern is itself
  // the evidence a single one lacks.
  noShowLapseRestrictionCount: {
    type: Number,
    default: 3,
    min: 1,
  },
  // CONFIRMED fault findings against a party, within a rolling 30 days, before
  // their account is restricted.
  //
  // A lower bar than the lapse count above and, unlike the dispute-loss count,
  // allowed to be 1 — because the three count different things. A lapse means
  // nobody spoke up, which is evidence about no one. A dispute loss means a
  // complaint was not upheld, which is not a finding of fault. A finding means an
  // admin established that this party failed to attend; that IS the evidence, so
  // it does not need a pattern to mean something.
  //
  // 0 disables auto-restriction while still recording every finding.
  confirmedFaultRestrictionCount: {
    type: Number,
    default: 2,
    min: 0,
  },
  // Disputes raised by one party and NOT upheld, within a rolling 30 days,
  // before that party's account is restricted.
  //
  // Raising a dispute freezes a held payment until an admin rules, and losing one
  // used to cost the raiser nothing — so either side could dispute every booking
  // and freeze every payout for free. Same shape as the cancellation and no-show
  // lapse triggers: rolling window, appealable, system-imposed.
  //
  // Minimum 2, and that floor is the safeguard: losing a single dispute is not
  // lying, and penalising one good-faith complaint teaches people not to
  // complain at all. Set to 0 or 1 to disable the trigger entirely.
  disputeLossRestrictionCount: {
    type: Number,
    default: 3,
    min: 0,
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
// Read the no-show settings for resolveDispute's reserved-time payout. Seeds
// defaults on first access, same as getSettings.
// Threshold for the repeat-losing-disputant restriction. Seeds defaults on
// first access, same as getSettings.
jobPostingSettingsSchema.statics.getDisputeAbuseConfig = async function () {
  const settings = await this.getSettings();
  return { disputeLossRestrictionCount: settings.disputeLossRestrictionCount };
};

jobPostingSettingsSchema.statics.getNoShowConfig = async function () {
  const settings = await this.getSettings();
  return {
    noShowReviewWindowHours: settings.noShowReviewWindowHours,
    noShowReviewReminderHours: settings.noShowReviewReminderHours,
    noShowPayoutPercentage: settings.noShowPayoutPercentage,
    noShowPayoutMinimum: settings.noShowPayoutMinimum,
    noShowPayoutHoldHours: settings.noShowPayoutHoldHours,
    noShowLapseRestrictionCount: settings.noShowLapseRestrictionCount,
    confirmedFaultRestrictionCount: settings.confirmedFaultRestrictionCount,
  };
};

jobPostingSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: 'job-posting' });
  if (!settings) {
    settings = await this.create({ key: 'job-posting' });
  }
  return settings;
};

module.exports = mongoose.model('JobPostingSettings', jobPostingSettingsSchema, 'jobpostingsettings');
