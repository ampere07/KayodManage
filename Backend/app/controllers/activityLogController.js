const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity, auditLog } = require('../utils/activityLogger');
const {
  AUDIT_GROUPS,
  AUDIT_ACTIONS,
  SENSITIVE_ACTION_TYPES,
  actionTypesInGroup,
} = require('../constants/auditActions');

const { getLocationFromIP } = require('../utils/geolocation');
const { LEGACY_STATUS_MAP } = require('../constants/reportTaxonomy');

// targetId populates through refPath, so every model a row can point at must be
// registered before the first populate — not every one is loaded at boot. The
// entry-detail endpoint also reads them directly for the target's current state.
const Transaction = require('../models/Transaction');
const ChatSupport = require('../models/ChatSupport');
const CredentialVerification = require('../models/CredentialVerification');
const Job = require('../models/Job');
const Report = require('../models/Report');
const ReportedPost = require('../models/ReportedPost');
const JobCategory = require('../models/JobCategory');
const Advertisement = require('../models/Advertisement');
const LegalDocument = require('../models/LegalDocument');

const ADMIN_TYPES = ['admin', 'superadmin', 'finance', 'customer support', 'support'];
const TARGET_FIELDS = 'name email title subject description type';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectId = (value, name) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw ApiError.badRequest(`Invalid ${name}`);
  return new mongoose.Types.ObjectId(value);
};

/** `{ $gte, $lte }` from ?from=&to= (ISO strings), or null when neither is set. */
const dateRange = ({ from, to }) => {
  const range = {};
  for (const [key, value] of [['$gte', from], ['$lte', to]]) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw ApiError.badRequest(`Invalid date "${value}"`);
    range[key] = date;
  }
  return Object.keys(range).length ? range : null;
};

/**
 * The Mongo filter for the audit log's query-string filters — shared by the
 * paged list and the CSV export, so an export holds exactly what's on screen.
 *
 * ?adminId= ?group= ?actionType= ?sensitive=true ?targetType= ?targetId= ?from= ?to= ?search=
 */
const buildLogQuery = async (params) => {
  const { adminId, group, actionType, targetType, targetId, search } = params;
  const query = {};
  if (adminId) query.adminId = toObjectId(adminId, 'adminId');

  // Action filter: one action, or a group, optionally narrowed to sensitive ones.
  let actionTypes = null;
  if (actionType && actionType !== 'all') actionTypes = [actionType];
  else if (group && group !== 'all') actionTypes = actionTypesInGroup(group);
  if (params.sensitive === 'true') {
    actionTypes = (actionTypes || SENSITIVE_ACTION_TYPES).filter((type) => SENSITIVE_ACTION_TYPES.includes(type));
  }
  if (actionTypes) query.actionType = { $in: actionTypes };
  if (targetType) query.targetType = targetType;
  if (targetId) query.targetId = toObjectId(targetId, 'targetId');
  const createdAt = dateRange(params);
  if (createdAt) query.createdAt = createdAt;

  // Search covers what the row says, what it was about, and who did it.
  if (search && search.trim()) {
    const pattern = new RegExp(escapeRegex(search.trim()), 'i');
    const admins = await User.find({
      userType: { $in: ADMIN_TYPES },
      $or: [{ name: pattern }, { email: pattern }],
    }).select('_id').lean();
    query.$or = [
      { description: pattern },
      { 'metadata.targetName': pattern },
      ...(admins.length ? [{ adminId: { $in: admins.map((a) => a._id) } }] : []),
    ];
  }
  return query;
};

// _id breaks ties so pages never overlap or skip entries logged in the same
// millisecond (bulk actions, the entry panel's page lookup).
const LOG_ORDER = { createdAt: -1, _id: -1 };

/**
 * GET /api/admin/activity-logs — the audit log, filtered (see buildLogQuery) and
 * paged on the server so every entry is reachable, not just the newest page.
 * ?page= ?limit=
 */
exports.getActivityLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const query = await buildLogQuery(req.query);

  const [logs, total] = await Promise.all([
    ActivityLog.find(query)
      .populate('adminId', 'name email userType')
      .populate({ path: 'targetId', select: TARGET_FIELDS })
      .sort(LOG_ORDER)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(query),
  ]);

  res.json({
    success: true,
    logs,
    total,
    page,
    limit,
    pages: Math.max(Math.ceil(total / limit), 1),
    hasMore: page * limit < total,
  });
}, 'Failed to fetch activity logs');

const EXPORT_LIMIT = 5000;

/**
 * One CSV cell. Quoted, with quotes doubled; cells a spreadsheet would run as a
 * formula (=, +, -, @ — descriptions carry user-entered names) get a leading
 * apostrophe so they open as text.
 */
const csvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const browserOf = (userAgent) => {
  if (!userAgent) return '';
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
  const os = /Windows/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad|iOS/.test(userAgent) ? 'iOS' : /Mac OS/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
};

/**
 * GET /api/admin/activity-logs/export — the current view (same filters as the
 * list) as a CSV download, newest first, up to EXPORT_LIMIT rows. The export is
 * itself audited: an audit log leaving the system is worth a row of its own.
 */
exports.exportActivityLogs = asyncHandler(async (req, res) => {
  const query = await buildLogQuery(req.query);
  const [logs, total] = await Promise.all([
    ActivityLog.find(query)
      .populate('adminId', 'name email userType')
      .populate({ path: 'targetId', select: TARGET_FIELDS })
      .sort(LOG_ORDER)
      .limit(EXPORT_LIMIT)
      .lean(),
    ActivityLog.countDocuments(query),
  ]);

  const header = ['When', 'Admin', 'Admin email', 'Role', 'Action', 'Area', 'Sensitive', 'What happened', 'Affected', 'Changes', 'IP address', 'Browser'];
  const rows = logs.map((log) => {
    const action = AUDIT_ACTIONS[log.actionType];
    const target = log.targetId && typeof log.targetId === 'object' ? log.targetId : null;
    const changes = Object.entries(log.metadata?.changes || {})
      .map(([field, change]) => `${field}: ${JSON.stringify(change?.from ?? null)} → ${JSON.stringify(change?.to ?? null)}`)
      .join('; ');
    return [
      new Date(log.createdAt).toISOString(),
      log.adminId?.name || '',
      log.adminId?.email || '',
      log.adminId?.userType || '',
      action?.label || log.actionType,
      AUDIT_GROUPS.find((g) => g.key === action?.group)?.label || '',
      action?.sensitive ? 'Yes' : 'No',
      log.description,
      target?.name || target?.title || target?.subject || log.metadata?.targetName || '',
      changes,
      log.ipAddress || '',
      browserOf(log.userAgent || log.metadata?.userAgent),
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

  const filters = Object.fromEntries(
    ['adminId', 'group', 'actionType', 'sensitive', 'targetId', 'from', 'to', 'search'].filter((k) => req.query[k]).map((k) => [k, req.query[k]])
  );
  await auditLog(req, 'audit_log_exported', `Exported ${logs.length} audit entr${logs.length === 1 ? 'y' : 'ies'} to CSV${total > logs.length ? ` (first ${logs.length} of ${total})` : ''}`, {
    metadata: { count: logs.length, total, filters },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="kayod-audit-log-${stamp}.csv"`);
  res.setHeader('X-Export-Count', String(logs.length));
  res.setHeader('X-Export-Total', String(total));
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Export-Count, X-Export-Total');
  // BOM so spreadsheet apps read it as UTF-8 (₱, accented names).
  res.send(`﻿${csv}`);
}, 'Failed to export the audit log');

/** GET /api/admin/activity-logs/catalog — every loggable action, its group and label. */
exports.getAuditCatalog = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    groups: AUDIT_GROUPS,
    actions: Object.entries(AUDIT_ACTIONS).map(([key, action]) => ({
      key,
      label: action.label,
      group: action.group,
      sensitive: Boolean(action.sensitive),
    })),
  });
}, 'Failed to fetch the audit catalog');

const TEAM_SORTS = {
  actions: (a) => a.actions,
  sensitive: (a) => a.sensitive,
  lastLogin: (a) => (a.lastLogin ? new Date(a.lastLogin).getTime() : null),
  lastActionAt: (a) => (a.lastActionAt ? new Date(a.lastActionAt).getTime() : null),
  name: (a) => String(a.name || '').toLowerCase(),
};

/**
 * GET /api/admin/activity-logs/team — one row per admin account: how much they
 * did in the window, how much of it was sensitive, when they last signed in and
 * last did anything. Admins with nothing in the window are included ("quiet for
 * 30 days" is worth seeing).
 *
 * ?from= ?to=        the window the counts cover
 * ?search=           name or email
 * ?activity=         active | none | sensitive
 * ?sort= ?order=     actions | sensitive | lastLogin | lastActionAt | name; asc | desc
 * ?page= ?limit=     paging (limit ≤ 100)
 * ?adminId=          just that admin's row
 *
 * `totals` always cover every admin in the window, whatever the search or page,
 * so the page header doesn't change as the table is filtered. Admin accounts
 * number in the hundreds at most, so rows are merged and sorted in memory.
 */
exports.getAuditTeam = asyncHandler(async (req, res) => {
  const createdAt = dateRange(req.query);
  const { search, activity, adminId } = req.query;
  const sort = TEAM_SORTS[req.query.sort] ? req.query.sort : 'actions';
  const order = req.query.order === 'asc' ? 1 : -1;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const [admins, windowStats, lastActions] = await Promise.all([
    User.find({ userType: { $in: ADMIN_TYPES } })
      .select('name email userType accountStatus lastLogin createdAt')
      .lean(),
    ActivityLog.aggregate([
      { $match: createdAt ? { createdAt } : {} },
      {
        $group: {
          _id: '$adminId',
          actions: { $sum: { $cond: [{ $eq: ['$actionType', 'admin_login'] }, 0, 1] } },
          logins: { $sum: { $cond: [{ $eq: ['$actionType', 'admin_login'] }, 1, 0] } },
          sensitive: { $sum: { $cond: [{ $in: ['$actionType', SENSITIVE_ACTION_TYPES] }, 1, 0] } },
        },
      },
    ]),
    // Last real action ever, independent of the window.
    ActivityLog.aggregate([
      { $match: { actionType: { $ne: 'admin_login' } } },
      { $group: { _id: '$adminId', lastActionAt: { $max: '$createdAt' } } },
    ]),
  ]);

  const statsBy = new Map(windowStats.map((s) => [String(s._id), s]));
  const lastBy = new Map(lastActions.map((s) => [String(s._id), s.lastActionAt]));

  const everyone = admins.map((admin) => {
    const stats = statsBy.get(String(admin._id)) || {};
    return {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      userType: admin.userType,
      accountStatus: admin.accountStatus,
      lastLogin: admin.lastLogin || null,
      lastActionAt: lastBy.get(String(admin._id)) || null,
      actions: stats.actions || 0,
      logins: stats.logins || 0,
      sensitive: stats.sensitive || 0,
    };
  });

  let rows = everyone;
  if (adminId) rows = rows.filter((a) => String(a._id) === String(adminId));
  if (search && search.trim()) {
    const pattern = new RegExp(escapeRegex(search.trim()), 'i');
    rows = rows.filter((a) => pattern.test(a.name || '') || pattern.test(a.email || ''));
  }
  if (activity === 'active') rows = rows.filter((a) => a.actions > 0);
  else if (activity === 'none') rows = rows.filter((a) => a.actions === 0);
  else if (activity === 'sensitive') rows = rows.filter((a) => a.sensitive > 0);

  // Missing dates (never signed in, never acted) sort last whichever way.
  const key = TEAM_SORTS[sort];
  rows = [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (x < y) return -order;
    if (x > y) return order;
    return String(a.name).localeCompare(String(b.name));
  });

  res.json({
    success: true,
    team: rows.slice((page - 1) * limit, page * limit),
    total: rows.length,
    page,
    limit,
    pages: Math.max(Math.ceil(rows.length / limit), 1),
    totals: {
      admins: everyone.length,
      actions: everyone.reduce((sum, a) => sum + a.actions, 0),
      logins: everyone.reduce((sum, a) => sum + a.logins, 0),
      sensitive: everyone.reduce((sum, a) => sum + a.sensitive, 0),
      activeAdmins: everyone.filter((a) => a.actions > 0).length,
    },
  });
}, 'Failed to fetch team activity');

// ── Entry detail ─────────────────────────────────────────────────────────────

const TARGET_KIND = {
  user: 'User',
  admin: 'Admin account',
  transaction: 'Transaction',
  support: 'Support ticket',
  verification: 'Verification',
  job: 'Job',
  report: 'Report',
  settings: 'Settings',
  job_category: 'Job category',
  profession: 'Profession',
  advertisement: 'Advertisement',
  legal_document: 'Legal document',
};

const humanize = (value) => String(value ?? '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const money = (value) =>
  typeof value === 'number' ? `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;
const day = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
const ACCOUNT_LABEL = { client: 'Customer', provider: 'Provider', superadmin: 'Superadmin' };

/** [{ label, value }] without the empty ones. */
const facts = (...pairs) =>
  pairs
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => ({ label, value: String(value) }));

/** "Suspended until Oct 30, 2026"; admin suspensions carry a far-future sentinel and read as open-ended. */
const accountStatus = (doc) => {
  const status = humanize(doc.accountStatus || 'active');
  const until = doc.restrictionDetails?.suspendedUntil;
  if (doc.accountStatus === 'suspended' && until && new Date(until).getFullYear() < 9999) return `${status} until ${day(until)}`;
  return status;
};

/**
 * What the entry was about, as it stands now: a name, a few facts and whether it
 * still exists. Read live, so a superadmin sees e.g. that a banned user is still
 * banned, or that a job hidden last week has since been restored.
 */
const describeTarget = async (log) => {
  if (!log.targetType) return null;
  const id = log.targetId ? String(log.targetId._id || log.targetId) : null;
  const base = {
    type: log.targetType,
    kind: TARGET_KIND[log.targetType] || humanize(log.targetType),
    id,
    label: log.metadata?.targetName || null,
    exists: null,
    facts: [],
  };
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return base;

  switch (log.targetModel) {
    case 'User': {
      const doc = await User.findById(id)
        .select('name email phone userType accountStatus isVerified createdAt lastLogin restrictionDetails')
        .lean();
      if (!doc) return { ...base, exists: false };
      const isAdmin = ADMIN_TYPES.includes(doc.userType);
      return {
        ...base,
        label: doc.name,
        exists: true,
        facts: facts(
          ['Email', doc.email],
          ['Account', ACCOUNT_LABEL[doc.userType] || humanize(doc.userType)],
          ['Status', accountStatus(doc)],
          ['Verified', isAdmin ? null : doc.isVerified ? 'Yes' : 'No'],
          [isAdmin ? 'Last login' : 'Joined', isAdmin ? day(doc.lastLogin) || 'Never' : day(doc.createdAt)]
        ),
      };
    }
    case 'Job': {
      const doc = await Job.findById(id)
        .select('title status budget budgetType professionName userId assignedToId isDeleted isHidden createdAt')
        .populate('userId', 'name')
        .populate('assignedToId', 'name')
        .lean();
      if (!doc) return { ...base, exists: false };
      const flags = [doc.isDeleted && 'deleted', doc.isHidden && 'hidden'].filter(Boolean);
      return {
        ...base,
        label: doc.title,
        exists: true,
        facts: facts(
          ['Status', `${humanize(doc.status)}${flags.length ? ` (${flags.join(', ')})` : ''}`],
          ['Budget', doc.budget ? money(doc.budget) : doc.budgetType ? humanize(doc.budgetType) : null],
          ['Profession', doc.professionName],
          ['Posted by', doc.userId?.name],
          ['Provider', doc.assignedToId?.name],
          ['Posted', day(doc.createdAt)]
        ),
      };
    }
    case 'Transaction': {
      const doc = await Transaction.findById(id)
        .select('type amount status fromUserId toUserId paymentMethod createdAt')
        .populate('fromUserId', 'name')
        .populate('toUserId', 'name')
        .lean();
      if (!doc) return { ...base, exists: false };
      return {
        ...base,
        label: `${humanize(doc.type)} · ${money(doc.amount)}`,
        exists: true,
        facts: facts(
          ['Amount', money(doc.amount)],
          ['Type', humanize(doc.type)],
          ['Status', humanize(doc.status)],
          ['From', doc.fromUserId?.name],
          ['To', doc.toUserId?.name],
          ['Method', doc.paymentMethod ? humanize(doc.paymentMethod) : null],
          ['Created', day(doc.createdAt)]
        ),
      };
    }
    case 'ChatSupport': {
      const doc = await ChatSupport.findById(id)
        .select('ticketId subject status category priority userName assignedToName createdAt')
        .lean();
      if (!doc) return { ...base, exists: false };
      return {
        ...base,
        label: doc.subject,
        exists: true,
        facts: facts(
          ['Ticket', doc.ticketId],
          ['Status', humanize(doc.status)],
          ['Customer', doc.userName],
          ['Category', doc.category ? humanize(doc.category) : null],
          ['Priority', doc.priority ? humanize(doc.priority) : null],
          ['Assigned to', doc.assignedToName],
          ['Opened', day(doc.createdAt)]
        ),
      };
    }
    case 'CredentialVerification': {
      const doc = await CredentialVerification.findById(id).select('status submittedAt userId').populate('userId', 'name').lean();
      if (!doc) return { ...base, exists: false };
      return {
        ...base,
        label: doc.userId?.name || base.label,
        exists: true,
        facts: facts(['Status', humanize(doc.status)], ['Submitted', day(doc.submittedAt)]),
      };
    }
    case 'Report':
    case 'ReportedPost': {
      const isPost = log.targetModel === 'ReportedPost';
      let query = (isPost ? ReportedPost : Report)
        .findById(id)
        .select('reportType reason status reportedUserId jobId createdAt')
        .populate('reportedUserId', 'name');
      if (isPost) query = query.populate('jobId', 'title');
      const doc = await query.lean();
      if (!doc) return { ...base, exists: false };
      return {
        ...base,
        label: (isPost && doc.jobId?.title) || doc.reportedUserId?.name || base.label || 'Report',
        exists: true,
        facts: facts(
          ['Type', doc.reportType ? humanize(doc.reportType) : 'Job post'],
          ['Reason', doc.reason ? humanize(doc.reason) : null],
          ['Status', humanize(doc.status)],
          ['Reported user', doc.reportedUserId?.name],
          ['Filed', day(doc.createdAt)]
        ),
      };
    }
    case 'JobCategory': {
      const doc = await JobCategory.findById(id).select('name professions serviceClass').lean();
      if (!doc) return { ...base, exists: false };
      if (log.targetType === 'profession') {
        const professionId = log.metadata?.professionId ? String(log.metadata.professionId) : null;
        const profession = (doc.professions || []).find((p) => String(p._id) === professionId);
        return {
          ...base,
          label: profession?.name || base.label,
          exists: Boolean(profession),
          facts: facts(
            ['Category', doc.name],
            ['Quick access', profession ? (profession.isQuickAccess ? 'Yes' : 'No') : null],
            ['Service class', profession ? (profession.serviceClass ? humanize(profession.serviceClass) : 'Same as category') : null]
          ),
        };
      }
      return {
        ...base,
        label: doc.name,
        exists: true,
        facts: facts(
          ['Professions', (doc.professions || []).length],
          ['Service class', doc.serviceClass ? humanize(doc.serviceClass) : null]
        ),
      };
    }
    case 'Advertisement': {
      const doc = await Advertisement.findById(id).select('title type status isActive order updatedAt').lean();
      if (!doc) return { ...base, exists: false };
      return {
        ...base,
        label: doc.title || base.label,
        exists: true,
        facts: facts(
          ['Status', humanize(doc.status || (doc.isActive ? 'published' : 'paused'))],
          ['Type', doc.type ? humanize(doc.type) : null],
          ['Carousel position', typeof doc.order === 'number' ? doc.order + 1 : null],
          ['Last edited', day(doc.updatedAt)]
        ),
      };
    }
    case 'LegalDocument': {
      const doc = await LegalDocument.findById(id).select('title version revision updatedAt updatedBy').lean();
      if (!doc) return { ...base, exists: false };
      return {
        ...base,
        label: doc.title,
        exists: true,
        facts: facts(['Version', doc.version], ['Revision', doc.revision], ['Last edited', day(doc.updatedAt)], ['Edited by', doc.updatedBy]),
      };
    }
    default:
      return base;
  }
};

/**
 * The records a bulk entry touched (today: reports, from the Flagged page's bulk
 * triage or the older reported-posts bulk endpoint), each with what it is and
 * its status now. Up to 50 are resolved; `total` says how many the entry covers.
 */
const describeBulkItems = async (log) => {
  const metadata = log.metadata || {};
  const refs = Array.isArray(metadata.reports)
    ? metadata.reports
    : Array.isArray(metadata.reportIds)
      ? metadata.reportIds.map((id) => ({ id, source: 'reported_post' }))
      : null;
  if (!refs || !refs.length) return null;

  const shown = refs.slice(0, 50).filter((ref) => ref && mongoose.Types.ObjectId.isValid(String(ref.id)));
  const idsFrom = (source) => shown.filter((ref) => ref.source === source).map((ref) => new mongoose.Types.ObjectId(String(ref.id)));
  const [reports, posts] = await Promise.all([
    Report.find({ _id: { $in: idsFrom('report') } }).select('reportType reason status reportedUserId').populate('reportedUserId', 'name').lean(),
    ReportedPost.find({ _id: { $in: idsFrom('reported_post') } })
      .select('reason status jobId reportedUserId')
      .populate('jobId', 'title')
      .populate('reportedUserId', 'name')
      .lean(),
  ]);
  const found = new Map([
    ...reports.map((doc) => [String(doc._id), { doc, kind: `${humanize(doc.reportType || 'other')} report` }]),
    ...posts.map((doc) => [String(doc._id), { doc, kind: 'Job post report' }]),
  ]);

  return {
    kind: 'report',
    total: refs.length,
    items: shown.map((ref) => {
      const id = String(ref.id);
      const hit = found.get(id);
      if (!hit) return { id, kind: 'Report', label: 'Report no longer exists', detail: null, status: null, exists: false };
      const { doc, kind } = hit;
      return {
        id,
        kind,
        label: doc.jobId?.title || doc.reportedUserId?.name || 'Report',
        detail: doc.reason ? humanize(doc.reason) : null,
        status: humanize(LEGACY_STATUS_MAP[doc.status] || doc.status || 'open'),
        exists: true,
      };
    }),
  };
};

const entrySummary = (entry) => ({
  _id: entry._id,
  actionType: entry.actionType,
  description: entry.description,
  createdAt: entry.createdAt,
  admin: entry.adminId && typeof entry.adminId === 'object' ? { _id: entry.adminId._id, name: entry.adminId.name } : null,
});

/**
 * GET /api/admin/activity-logs/:logId — everything about one entry: the action,
 * who did it and from where (location from the IP, browser), what it affected as
 * that thing stands now, the other entries about the same thing, and where the
 * entry sits in its admin's history — so the panel can open that history (paged
 * through the list endpoint) on the page holding this entry.
 */
exports.getActivityLogDetail = asyncHandler(async (req, res) => {
  const log = await ActivityLog.findById(toObjectId(req.params.logId, 'logId'))
    .populate('adminId', 'name email userType accountStatus lastLogin')
    .lean();
  if (!log) throw ApiError.notFound('Audit entry not found');

  const adminId = log.adminId?._id;
  const [target, bulk, aboutTarget, aboutTargetTotal, adminTotal, newerByAdmin] = await Promise.all([
    describeTarget(log),
    describeBulkItems(log),
    log.targetId
      ? ActivityLog.find({ targetId: log.targetId, _id: { $ne: log._id } })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('adminId', 'name')
          .lean()
      : [],
    log.targetId ? ActivityLog.countDocuments({ targetId: log.targetId, _id: { $ne: log._id } }) : 0,
    adminId ? ActivityLog.countDocuments({ adminId }) : 0,
    // Entries ahead of this one in the list's order (newest first, ties by _id).
    adminId
      ? ActivityLog.countDocuments({
          adminId,
          $or: [{ createdAt: { $gt: log.createdAt } }, { createdAt: log.createdAt, _id: { $gt: log._id } }],
        })
      : 0,
  ]);

  const action = AUDIT_ACTIONS[log.actionType];
  const ipAddress = log.ipAddress || null;
  res.json({
    success: true,
    log,
    action: {
      key: log.actionType,
      label: action?.label || humanize(log.actionType),
      group: action?.group || null,
      groupLabel: AUDIT_GROUPS.find((g) => g.key === action?.group)?.label || null,
      sensitive: Boolean(action?.sensitive),
    },
    origin: {
      ipAddress,
      location: ipAddress ? getLocationFromIP(ipAddress) : null,
      userAgent: log.userAgent || log.metadata?.userAgent || null,
    },
    target,
    // For bulk entries: the records the batch touched, as they are now.
    bulk,
    aboutTarget: aboutTarget.map(entrySummary),
    aboutTargetTotal,
    // position: 0-based index of this entry in the admin's newest-first history.
    adminHistory: { total: adminTotal, position: newerByAdmin },
  });
}, 'Failed to fetch the audit entry');

// Kept for the controllers that already call it; the one implementation lives
// in utils/activityLogger.js (non-fatal by design — see the note there).
exports.createActivityLog = (adminId, actionType, description, options = {}) =>
  logActivity(adminId, actionType, description, options);

// Exported for unit tests — the CSV guard is what keeps a user-entered name
// from running as a spreadsheet formula when an export is opened.
exports._csvCell = csvCell;
