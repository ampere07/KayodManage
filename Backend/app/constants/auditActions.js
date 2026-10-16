/**
 * The audit log's action catalog — the one list of what an admin action can be
 * logged as.
 *
 * The ActivityLog `actionType` enum is built from these keys, the per-admin
 * timeline takes its labels from here, and the Audit Log page reads the whole
 * catalog from GET /api/admin/activity-logs/catalog. Adding a logged action is
 * one entry here; nothing else needs to learn about it.
 *
 *   group     — the filter bucket on the Audit Log page (AUDIT_GROUPS).
 *   label     — how the action reads in a list ("User banned").
 *   sensitive — changes someone's access, moves money, or changes what every
 *               user sees. Highlighted on the page and counted per admin.
 */

const AUDIT_GROUPS = [
  { key: 'access', label: 'Team & access' },
  { key: 'users', label: 'Users' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'money', label: 'Money' },
  { key: 'support', label: 'Support' },
  { key: 'moderation', label: 'Reports' },
  { key: 'config', label: 'Configuration' },
];

const AUDIT_ACTIONS = {
  // Team & access
  admin_login: { group: 'access', label: 'Signed in' },
  admin_created: { group: 'access', label: 'Admin created', sensitive: true },
  admin_updated: { group: 'access', label: 'Admin details edited' },
  admin_role_changed: { group: 'access', label: 'Admin role changed', sensitive: true },
  admin_permissions_changed: { group: 'access', label: 'Permissions changed', sensitive: true },
  admin_status_changed: { group: 'access', label: 'Admin access turned on/off', sensitive: true },
  admin_password_reset: { group: 'access', label: 'Admin password reset', sensitive: true },
  audit_log_exported: { group: 'access', label: 'Audit log exported', sensitive: true },

  // Users
  verification_approved: { group: 'users', label: 'Verification approved' },
  verification_rejected: { group: 'users', label: 'Verification rejected' },
  user_verified: { group: 'users', label: 'User marked verified' },
  user_unverified: { group: 'users', label: 'User verification removed' },
  user_restricted: { group: 'users', label: 'User restricted', sensitive: true },
  user_suspended: { group: 'users', label: 'User suspended', sensitive: true },
  user_banned: { group: 'users', label: 'User banned', sensitive: true },
  user_unrestricted: { group: 'users', label: 'User unrestricted' },
  user_deleted: { group: 'users', label: 'User deleted', sensitive: true },

  // Jobs
  job_status_changed: { group: 'jobs', label: 'Job status changed' },
  job_assigned: { group: 'jobs', label: 'Job assigned to provider' },
  job_hidden: { group: 'jobs', label: 'Job hidden' },
  // Unhiding and restoring-from-delete are different actions; keep them apart.
  job_unhidden: { group: 'jobs', label: 'Job unhidden' },
  job_deleted: { group: 'jobs', label: 'Job deleted', sensitive: true },
  job_restored: { group: 'jobs', label: 'Job restored' },
  job_force_cancelled: { group: 'jobs', label: 'Job force-cancelled', sensitive: true },
  dispute_resolved: { group: 'jobs', label: 'Dispute resolved', sensitive: true },

  // Money
  transaction_completed: { group: 'money', label: 'Transaction approved', sensitive: true },
  transaction_failed: { group: 'money', label: 'Transaction declined' },
  bulk_transaction_approval: { group: 'money', label: 'Top-ups bulk-approved', sensitive: true },

  // Support
  support_accepted: { group: 'support', label: 'Ticket accepted' },
  support_closed: { group: 'support', label: 'Ticket closed' },
  support_reopened: { group: 'support', label: 'Ticket reopened' },

  // Reports
  report_reviewed: { group: 'moderation', label: 'Report reviewed' },
  reports_bulk_reviewed: { group: 'moderation', label: 'Reports bulk-reviewed' },
  report_deleted: { group: 'moderation', label: 'Report deleted', sensitive: true },

  // Configuration
  settings_updated: { group: 'config', label: 'Job & fee settings changed', sensitive: true },
  job_category_created: { group: 'config', label: 'Category created' },
  job_category_updated: { group: 'config', label: 'Category edited' },
  job_category_deleted: { group: 'config', label: 'Category deleted', sensitive: true },
  profession_created: { group: 'config', label: 'Profession created' },
  profession_updated: { group: 'config', label: 'Profession edited' },
  profession_deleted: { group: 'config', label: 'Profession deleted', sensitive: true },
  profession_transferred: { group: 'config', label: 'Profession moved' },
  quick_access_updated: { group: 'config', label: 'Quick access changed' },
  advertisement_created: { group: 'config', label: 'Ad created' },
  advertisement_updated: { group: 'config', label: 'Ad edited' },
  advertisement_deleted: { group: 'config', label: 'Ad deleted' },
  advertisements_reordered: { group: 'config', label: 'Ads reordered' },
  legal_document_updated: { group: 'config', label: 'Legal document edited', sensitive: true },
  legal_document_reset: { group: 'config', label: 'Legal document reset', sensitive: true },
};

const AUDIT_ACTION_TYPES = Object.keys(AUDIT_ACTIONS);
const SENSITIVE_ACTION_TYPES = AUDIT_ACTION_TYPES.filter((key) => AUDIT_ACTIONS[key].sensitive);

const actionTypesInGroup = (group) => AUDIT_ACTION_TYPES.filter((key) => AUDIT_ACTIONS[key].group === group);

// What a log row can point at, and the model its targetId populates from.
const AUDIT_TARGET_TYPES = [
  'user', 'admin', 'transaction', 'support', 'verification', 'job', 'report',
  'settings', 'job_category', 'profession', 'advertisement', 'legal_document',
];
const AUDIT_TARGET_MODELS = [
  'User', 'Transaction', 'ChatSupport', 'CredentialVerification', 'Job', 'Report',
  'ReportedPost', 'JobCategory', 'Advertisement', 'LegalDocument',
];

module.exports = {
  AUDIT_GROUPS,
  AUDIT_ACTIONS,
  AUDIT_ACTION_TYPES,
  SENSITIVE_ACTION_TYPES,
  AUDIT_TARGET_TYPES,
  AUDIT_TARGET_MODELS,
  actionTypesInGroup,
};
