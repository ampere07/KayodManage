const mongoose = require('mongoose');
const Advertisement = require('../models/Advertisement');
const AdvertisementStat = require('../models/AdvertisementStat');
const imageKitService = require('../services/imageKitService');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { auditLog, diffFields, describeChanges } = require('../utils/activityLogger');
const {
  DEFAULT_PLACEMENT,
  PLACEMENTS,
  parsePlacements,
  parseScheduleDate,
  scheduleError,
  showingFilter,
  stateOf,
  summarizeStats,
} = require('../utils/advertisementRules');

// What the audit row diffs on an edit — everything an admin sees, minus the
// ImageKit file id (the image URL already says the picture changed).
const AUDITED_FIELDS = ['type', 'title', 'subtitle', 'highlight', 'ctaLabel', 'imageUrl', 'overlays', 'linkAction', 'placements', 'startsAt', 'endsAt', 'status'];

// Days of performance the admin list carries for each ad.
const STATS_DAYS = 14;

const adTarget = (advertisement) => ({
  targetType: 'advertisement',
  targetId: advertisement._id,
  targetModel: 'Advertisement',
});

const adName = (advertisement) => advertisement.title || `${advertisement.type || 'untitled'} ad`;

// Fields an admin may set/update on an advertisement.
const EDITABLE_FIELDS = [
  'type',
  'title',
  'subtitle',
  'highlight',
  'ctaLabel',
  'imageUrl',
  'imageFileId',
  'overlays',
  'linkAction',
  'placements',
  'startsAt',
  'endsAt',
  'status',
  'isActive',
  'order',
];

/**
 * Checks and cleans placements and the schedule on an incoming payload.
 * `current` is the ad being edited (null when creating), so a change to one
 * end of the schedule is checked against the other end already saved.
 * Mutates `data`; returns an error message, or null when it is valid.
 */
const reconcileTargeting = (data, current) => {
  if (data.placements !== undefined) {
    const parsed = parsePlacements(data.placements);
    if (parsed.error) return parsed.error;
    data.placements = parsed.value;
  } else if (!current) {
    data.placements = [DEFAULT_PLACEMENT];
  }
  for (const key of ['startsAt', 'endsAt']) {
    if (data[key] === undefined) continue;
    const parsed = parseScheduleDate(data[key]);
    if (parsed.error) return parsed.error;
    data[key] = parsed.value;
  }
  const startsAt = data.startsAt !== undefined ? data.startsAt : current?.startsAt ?? null;
  const endsAt = data.endsAt !== undefined ? data.endsAt : current?.endsAt ?? null;
  return scheduleError(startsAt, endsAt);
};

/**
 * ImageKit files are shared once an ad is duplicated, so a file is only
 * deleted when no other ad still shows it.
 */
const deleteImageIfUnused = async (fileId, exceptId) => {
  if (!fileId) return;
  const stillUsed = await Advertisement.exists({ _id: { $ne: exceptId }, imageFileId: fileId });
  if (!stillUsed) await imageKitService.deleteFile(fileId);
};

const pickEditable = (body) => {
  const out = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
};

const STATUSES = ['draft', 'published', 'paused'];

// `status` is the admin-facing lifecycle; `isActive` is what the client app
// filters on. Documents written before `status` existed only have `isActive`.
const statusOf = (ad) => ad.status || (ad.isActive ? 'published' : 'paused');

/**
 * Reconciles the two representations on an incoming payload, so a caller may
 * send either one. `currentStatus` is null when creating.
 * Mutates `data`; returns an error message, or null when it is valid.
 */
const reconcileStatus = (data, currentStatus) => {
  if (data.status !== undefined) {
    if (!STATUSES.includes(data.status)) {
      return 'Status must be draft, published or paused';
    }
    data.isActive = data.status === 'published';
    return null;
  }
  if (data.isActive !== undefined) {
    // Legacy callers send only isActive. Switching a draft off leaves it a
    // draft rather than silently promoting it to "paused".
    data.status = data.isActive
      ? 'published'
      : currentStatus === 'draft'
        ? 'draft'
        : 'paused';
    return null;
  }
  if (currentStatus === null) {
    // Neither field sent on create — go live, matching the old isActive default.
    data.status = 'published';
    data.isActive = true;
  }
  return null;
};

const LINK_MAX = 512;
const ROUTE_RE = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const HTTPS_RE = /^https:\/\/[^\s/$.?#][^\s]*$/i;

// linkAction is '' | a Kayod client route name | an https:// URL.
// Deliberately NOT an enum of route names: the route catalog belongs to the
// mobile client and changes on its release cadence — an enum here would force an
// admin-backend deploy for every app release. Validating the shape still blocks
// javascript:/data:/file: payloads at the only write path.
const linkActionError = (value) => {
  if (value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.length > LINK_MAX) return 'Link is too long';
  if (HTTPS_RE.test(s) || ROUTE_RE.test(s)) return null;
  return 'Navigate-to must be a screen name or an https:// link';
};

// GET /advertisements — admin: all ads, ordered, each with its state right now
// and its performance (views and taps the app counted).
exports.getAdvertisements = asyncHandler(async (req, res) => {
  const now = new Date();
  const advertisements = await Advertisement.find()
    .sort({ order: 1, createdAt: 1 })
    .lean();
  const statRows = advertisements.length
    ? await AdvertisementStat.find({ advertisement: { $in: advertisements.map((ad) => ad._id) } })
      .select('advertisement day placement views taps')
      .lean()
    : [];
  const rowsByAd = new Map();
  for (const row of statRows) {
    const key = String(row.advertisement);
    if (!rowsByAd.has(key)) rowsByAd.set(key, []);
    rowsByAd.get(key).push(row);
  }
  // Backfill `status` on documents written before the field existed, so the
  // admin UI always has a lifecycle to render.
  res.status(200).json({
    success: true,
    advertisements: advertisements.map((ad) => {
      const withStatus = { ...ad, status: statusOf(ad) };
      const rows = rowsByAd.get(String(ad._id)) || [];
      return {
        ...withStatus,
        state: stateOf(withStatus, now),
        stats: {
          ...summarizeStats(rows, STATS_DAYS, now),
          byPlacement: Object.fromEntries(PLACEMENTS.map((p) => {
            const own = summarizeStats(rows.filter((r) => r.placement === p), STATS_DAYS, now);
            return [p, { views: own.views, taps: own.taps }];
          })),
        },
      };
    }),
  });
}, 'Failed to fetch advertisements');

// GET /advertisements/public?placement= — ads showing now in one carousel,
// by the same rule as the Kayod app's own endpoint.
exports.getPublicAdvertisements = asyncHandler(async (req, res) => {
  const placement = PLACEMENTS.includes(req.query?.placement) ? req.query.placement : DEFAULT_PLACEMENT;
  const advertisements = await Advertisement.find(showingFilter(placement, new Date()))
    .sort({ order: 1, createdAt: 1 })
    .lean();
  res.status(200).json({ success: true, advertisements });
}, 'Failed to fetch advertisements');

// POST /advertisements — create a new ad.
exports.createAdvertisement = asyncHandler(async (req, res) => {
  const data = pickEditable(req.body);

  if (data.type === 'image' && !data.imageUrl) {
    return res.status(400).json({
      success: false,
      message: 'An image ad requires an uploaded image',
    });
  }

  const linkError = linkActionError(data.linkAction);
  if (linkError) {
    return res.status(400).json({ success: false, message: linkError });
  }

  const statusError = reconcileStatus(data, null);
  if (statusError) {
    return res.status(400).json({ success: false, message: statusError });
  }

  const targetingError = reconcileTargeting(data, null);
  if (targetingError) {
    return res.status(400).json({ success: false, message: targetingError });
  }

  // New ads go to the end of the carousel unless an order was provided.
  if (data.order === undefined) {
    const last = await Advertisement.findOne().sort({ order: -1 }).lean();
    data.order = last ? (last.order || 0) + 1 : 0;
  }

  const advertisement = await Advertisement.create(data);
  await auditLog(req, 'advertisement_created', `Created ${advertisement.status || 'draft'} ad "${adName(advertisement)}"`, {
    ...adTarget(advertisement),
    metadata: { targetName: adName(advertisement), status: advertisement.status },
  });
  res.status(201).json({ success: true, advertisement });
}, 'Failed to create advertisement');

// PATCH /advertisements/:id — update an ad.
exports.updateAdvertisement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const advertisement = await Advertisement.findById(id);
  if (!advertisement) {
    return res.status(404).json({ success: false, message: 'Advertisement not found' });
  }

  const data = pickEditable(req.body);

  const linkError = linkActionError(data.linkAction);
  if (linkError) {
    return res.status(400).json({ success: false, message: linkError });
  }

  const currentStatus = statusOf(advertisement);
  const statusError = reconcileStatus(data, currentStatus);
  if (statusError) {
    return res.status(400).json({ success: false, message: statusError });
  }
  // Backfill the field on a document that predates it, even when this edit
  // did not touch the lifecycle.
  if (data.status === undefined) data.status = currentStatus;

  const targetingError = reconcileTargeting(data, advertisement);
  if (targetingError) {
    return res.status(400).json({ success: false, message: targetingError });
  }

  // If the image is being replaced, clean up the old ImageKit file (best-effort),
  // unless a duplicate of this ad still uses it.
  if (
    data.imageFileId !== undefined &&
    advertisement.imageFileId &&
    advertisement.imageFileId !== data.imageFileId
  ) {
    await deleteImageIfUnused(advertisement.imageFileId, advertisement._id);
  }

  const adBefore = advertisement.toObject();
  Object.assign(advertisement, data);
  await advertisement.save();

  const adChanges = diffFields(adBefore, advertisement.toObject(), AUDITED_FIELDS);
  if (Object.keys(adChanges).length) {
    await auditLog(req, 'advertisement_updated', `Edited ad "${adName(advertisement)}": ${describeChanges(adChanges)}`, {
      ...adTarget(advertisement),
      metadata: { targetName: adName(advertisement), changes: adChanges },
    });
  }

  res.status(200).json({ success: true, advertisement });
}, 'Failed to update advertisement');

// PATCH /advertisements/reorder — set the carousel sequence from an ordered
// array of ids. `order` drives the client's promo carousel, which sorts by
// { order: 1, createdAt: 1 }. Ids omitted from the array keep their current
// order value, so a partial list would interleave — the admin always sends the
// full list.
exports.reorderAdvertisements = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'ids must be a non-empty array of advertisement ids',
    });
  }
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return res.status(400).json({
      success: false,
      message: 'ids contains an invalid advertisement id',
    });
  }
  if (new Set(ids.map(String)).size !== ids.length) {
    return res.status(400).json({
      success: false,
      message: 'ids contains duplicates',
    });
  }

  await Advertisement.bulkWrite(
    ids.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index, updatedAt: new Date() } },
      },
    })),
  );

  const advertisements = await Advertisement.find()
    .sort({ order: 1, createdAt: 1 })
    .lean();

  await auditLog(req, 'advertisements_reordered', `Reordered the ad carousel: ${advertisements.map(adName).join(', ')}`, {
    targetType: 'advertisement',
    metadata: { order: advertisements.map((ad) => ({ id: ad._id, title: adName(ad) })) },
  });

  res.status(200).json({ success: true, advertisements });
}, 'Failed to reorder advertisements');

// DELETE /advertisements/:id — delete an ad (and its uploaded image, if any).
exports.deleteAdvertisement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const advertisement = await Advertisement.findById(id);
  if (!advertisement) {
    return res.status(404).json({ success: false, message: 'Advertisement not found' });
  }

  await deleteImageIfUnused(advertisement.imageFileId, advertisement._id);

  await advertisement.deleteOne();
  // Its view and tap counts go with it; nothing else reads them.
  await AdvertisementStat.deleteMany({ advertisement: advertisement._id });
  await auditLog(req, 'advertisement_deleted', `Deleted ad "${adName(advertisement)}"`, {
    ...adTarget(advertisement),
    metadata: { targetName: adName(advertisement), status: advertisement.status },
  });
  res.status(200).json({ success: true, message: 'Advertisement deleted' });
}, 'Failed to delete advertisement');

// POST /advertisements/:id/duplicate — a draft copy at the end of the carousel,
// with the same content, image, destination, placements and schedule. The
// image file is shared (deletes check for that); performance starts at zero.
exports.duplicateAdvertisement = asyncHandler(async (req, res) => {
  const source = await Advertisement.findById(req.params.id).lean();
  if (!source) {
    return res.status(404).json({ success: false, message: 'Advertisement not found' });
  }

  const last = await Advertisement.findOne().sort({ order: -1 }).lean();
  const copy = await Advertisement.create({
    type: source.type,
    title: source.title ? `${source.title} (copy)` : '',
    subtitle: source.subtitle,
    highlight: source.highlight,
    ctaLabel: source.ctaLabel,
    imageUrl: source.imageUrl,
    imageFileId: source.imageFileId,
    overlays: source.overlays || [],
    linkAction: source.linkAction,
    placements: source.placements && source.placements.length ? source.placements : [DEFAULT_PLACEMENT],
    startsAt: source.startsAt || null,
    endsAt: source.endsAt || null,
    status: 'draft',
    isActive: false,
    order: last ? (last.order || 0) + 1 : 0,
  });

  await auditLog(req, 'advertisement_created', `Duplicated ad "${adName(source)}" as a draft`, {
    ...adTarget(copy),
    metadata: { targetName: adName(copy), status: 'draft', duplicatedFrom: { id: source._id, title: adName(source) } },
  });
  res.status(201).json({ success: true, advertisement: { ...copy.toObject(), state: 'draft' } });
}, 'Failed to duplicate advertisement');

// POST /advertisements/upload-image — upload a banner image, returns { url, fileId }.
exports.uploadAdvertisementImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }

  const safeBase = (req.body.name || 'ad')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'ad';
  const fileName = `${safeBase}.webp`;

  const result = await imageKitService.uploadBanner(
    req.file.buffer,
    fileName,
    'advertisements',
    ['advertisement'],
  );

  res.status(200).json({
    success: true,
    url: result.url,
    fileId: result.fileId,
  });
}, 'Failed to upload image');
