const ActivityLog = require('../models/ActivityLog');
const mongoose = require('mongoose');
const { currentRequest } = require('./requestContext');

/** The caller's IP, through the proxy when there is one — the rule login uses. */
const requestIp = (req) =>
  req?.headers?.['x-forwarded-for']?.split(',')[0].trim() ||
  req?.headers?.['x-real-ip'] ||
  req?.ip ||
  undefined;

const logActivity = async (adminId, actionType, description, options = {}) => {
  try {
    // Ensure adminId is a valid ObjectId
    let validAdminId;
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      validAdminId = adminId;
    } else {
      console.warn('⚠️  Invalid adminId provided:', adminId);
      return null;
    }

    const req = currentRequest();
    const log = new ActivityLog({
      adminId: validAdminId,
      actionType,
      description,
      targetType: options.targetType,
      targetId: options.targetId,
      targetModel: options.targetModel,
      metadata: options.metadata || {},
      // Callers that don't pass these still get them from the request being handled.
      ipAddress: options.ipAddress || requestIp(req),
      userAgent: String(options.userAgent || req?.headers?.['user-agent'] || '').slice(0, 300) || undefined
    });

    await log.save();

    // Real-time refresh for the Audit Log page. Only superadmins can read the
    // log, so only they are told a row was added — and only its id and type.
    try {
      const server = require('../../server');
      const io = server.io;

      if (io) {
        io.of('/admin').to('superadmins').emit('activity:new', {
          logId: log._id,
          actionType: log.actionType
        });
      }
    } catch (socketError) {
      console.error('❌ Error emitting socket event:', socketError);
    }

    return log;
  } catch (error) {
    // Deliberately non-fatal: every caller logs AFTER its business transaction
    // has committed, so throwing here would turn a missing audit row into a 500
    // on an operation that already succeeded (and, for refunds, already moved
    // money). The values are logged alongside the error because the usual cause
    // is an actionType/targetType missing from constants/auditActions.js, which
    // is otherwise invisible.
    console.error('❌ Error logging activity:', {
      actionType,
      targetType: options.targetType,
      targetModel: options.targetModel,
      error: error.message
    });
    console.error(error.stack);
    return null;
  }
};

/** The admin acting on this request: adminAuth sets req.admin; the session is the fallback. */
const actingAdminId = (req) =>
  req?.admin?.id || req?.session?.adminId || req?.session?.userId || req?.user?.id;

/**
 * Log an admin action from inside a request handler. Works out who did it and
 * from where, so call sites only say what happened. Never throws (see above).
 */
const auditLog = (req, actionType, description, options = {}) =>
  logActivity(actingAdminId(req), actionType, description, {
    ipAddress: requestIp(req),
    userAgent: req?.headers?.['user-agent'],
    ...options,
  });

/**
 * `{ field: { from, to } }` for every listed field whose value changed. Values
 * compare by content, so permission objects and arrays diff correctly. Pass
 * plain values captured before the edit (e.g. `doc.toObject()`), not the doc.
 */
const diffFields = (before, after, fields) => {
  const changes = {};
  for (const field of fields) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  }
  return changes;
};

const ACRONYMS = { asap: 'ASAP', cta: 'CTA', url: 'URL', id: 'ID' };

/** "bookingFeePercentage" → "Booking fee percentage"; "asapFee" → "ASAP fee". */
const fieldLabel = (field) => {
  const words = String(field).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(' ').map((w) => ACRONYMS[w] || w).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const shortValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return '…';
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 37)}…` : text;
};

/** "Booking fee percentage 5 → 7, Asap fee 50 → 60 and 2 more" — for a row's description. */
const describeChanges = (changes, limit = 3) => {
  const entries = Object.entries(changes);
  const shown = entries
    .slice(0, limit)
    .map(([field, { from, to }]) => `${fieldLabel(field)} ${shortValue(from)} → ${shortValue(to)}`);
  const more = entries.length - shown.length;
  return shown.join(', ') + (more > 0 ? ` and ${more} more` : '');
};

module.exports = { logActivity, auditLog, diffFields, describeChanges, fieldLabel, requestIp };
