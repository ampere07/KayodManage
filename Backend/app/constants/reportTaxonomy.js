/**
 * Canonical report taxonomy — the single source of truth for report reasons
 * and the report status lifecycle.
 *
 * Both Report and ReportedPost import from here. They used to declare their
 * own enums inline and had drifted into using different words for identical
 * concepts ("scam" vs "scam_or_fraud", "fake_job" vs "fake_job_posting"),
 * Report listed "fraud" twice, and neither list matched the reasons the app
 * actually sent. One vocabulary, defined once.
 *
 * This file exists twice and the two copies MUST stay byte-identical:
 *   - kayod/server/src/constants/reportTaxonomy.js
 *   - KayodManage/Backend/app/constants/reportTaxonomy.js
 * The admin app is a separate deployment and is not part of the pnpm workspace
 * (see pnpm-workspace.yaml: packages: ['kayod/*']), so it cannot import across.
 * `npm run check:report-taxonomy` diffs the two copies and fails on drift; it
 * runs as part of lint. Edit one, copy to the other.
 */

// ---------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------

/** Every canonical reason, grouped by what is being reported. */
const REPORT_REASONS_BY_TYPE = {
  job: [
    "spam",
    "inappropriate_content",
    "misleading_information",
    "fake_job_posting",
    "duplicate_posting",
    "scam_or_fraud",
    "discrimination",
    "harassment",
    "violence_or_threats",
    "adult_content",
    "copyright_violation",
    "unsafe_work_conditions",
    "payment_issues",
    "other",
  ],
  // Reporting a person — for a client reporting the provider who worked their
  // job, this is the conduct/quality vocabulary surfaced on a completed job.
  user: [
    "unfinished_work",
    "substandard_work",
    "payment_issues",
    "harassment",
    "unsafe_work_conditions",
    "scam_or_fraud",
    "discrimination",
    "violence_or_threats",
    "misconduct",
    "fake_profile",
    "other",
  ],
  message: [
    "harassment",
    "threats",
    "unsolicited_solicitation",
    "inappropriate_content",
    "adult_content",
    "scam_or_fraud",
    "other",
  ],
  conversation: [
    "harassment",
    "inappropriate_behavior",
    "adult_content",
    "scam_or_fraud",
    "other",
  ],
  review: [
    "fake_review",
    "defamation",
    "conflict_of_interest",
    "inappropriate_content",
    "other",
  ],
  payment: ["unauthorized_charge", "payment_dispute", "scam_or_fraud", "other"],
  other: ["other"],
};

/** Flat, de-duplicated list — this is what the Mongoose enums use. */
const REPORT_REASONS = [
  ...new Set(Object.values(REPORT_REASONS_BY_TYPE).flat()),
];

/** Reasons that mean "I want my money back", i.e. the dispute path. */
const MONETARY_REASONS = [
  "unfinished_work",
  "substandard_work",
  "payment_issues",
  "scam_or_fraud",
];

const REPORT_REASON_LABELS = {
  spam: "Spam",
  inappropriate_content: "Inappropriate Content",
  misleading_information: "Misleading Information",
  fake_job_posting: "Fake Job Posting",
  duplicate_posting: "Duplicate Posting",
  scam_or_fraud: "Scam or Fraud",
  discrimination: "Discrimination",
  harassment: "Harassment",
  violence_or_threats: "Violence or Threats",
  adult_content: "Adult Content",
  copyright_violation: "Copyright Violation",
  unsafe_work_conditions: "Unsafe Work Conditions",
  payment_issues: "Payment Issues",
  unfinished_work: "Work Was Unfinished",
  substandard_work: "Work Quality Was Substandard",
  misconduct: "Misconduct",
  fake_profile: "Fake Profile",
  threats: "Threats",
  unsolicited_solicitation: "Unsolicited Solicitation",
  inappropriate_behavior: "Inappropriate Behavior",
  fake_review: "Fake Review",
  defamation: "Defamation",
  conflict_of_interest: "Conflict of Interest",
  unauthorized_charge: "Unauthorized Charge",
  payment_dispute: "Payment Dispute",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Status lifecycle
// ---------------------------------------------------------------------------

/**
 * open         — filed, untriaged
 * under_review — an admin has picked it up
 * action_taken — closed with a moderation action (see ACTIONS_TAKEN)
 * dismissed    — closed with no action
 * escalated    — converted into a job dispute; the money outcome is now
 *                tracked on job.completionStatus.dispute, not here
 *
 * Replaces pending/reviewed/resolved/dismissed, where "reviewed" and
 * "resolved" overlapped with no defined transition and there was no way to
 * record that a report had become a dispute.
 */
const REPORT_STATUSES = [
  "open",
  "under_review",
  "action_taken",
  "dismissed",
  "escalated",
];

const REPORT_STATUS_LABELS = {
  open: "Open",
  under_review: "Under Review",
  action_taken: "Action Taken",
  dismissed: "Dismissed",
  escalated: "Escalated to Dispute",
};

/** Statuses that still need admin attention. */
const OPEN_REPORT_STATUSES = ["open", "under_review"];

const ACTIONS_TAKEN = [
  "none",
  "post_deleted",
  "post_approved",
  "user_warned",
  "user_restricted",
  "user_suspended",
  "report_dismissed",
  "conversation_deleted",
  "message_deleted",
  "escalated_to_dispute",
];

// ---------------------------------------------------------------------------
// Legacy migration maps — consumed by
// tools/migrate_report_taxonomy.js
// ---------------------------------------------------------------------------

const LEGACY_REASON_MAP = {
  scam: "scam_or_fraud",
  fraud: "scam_or_fraud",
  fake_job: "fake_job_posting",
};

const LEGACY_STATUS_MAP = {
  pending: "open",
  reviewed: "under_review",
  resolved: "action_taken",
};

module.exports = {
  REPORT_REASONS,
  REPORT_REASONS_BY_TYPE,
  REPORT_REASON_LABELS,
  MONETARY_REASONS,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  OPEN_REPORT_STATUSES,
  ACTIONS_TAKEN,
  LEGACY_REASON_MAP,
  LEGACY_STATUS_MAP,
};
