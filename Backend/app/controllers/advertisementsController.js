const mongoose = require('mongoose');
const Advertisement = require('../models/Advertisement');
const imageKitService = require('../services/imageKitService');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { auditLog, diffFields, describeChanges } = require('../utils/activityLogger');

// What the audit row diffs on an edit — everything an admin sees, minus the
// ImageKit file id (the image URL already says the picture changed).
const AUDITED_FIELDS = ['type', 'title', 'subtitle', 'highlight', 'ctaLabel', 'imageUrl', 'overlays', 'linkAction', 'status'];

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
  'status',
  'isActive',
  'order',
];

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

// GET /advertisements — admin: all ads, ordered.
exports.getAdvertisements = asyncHandler(async (req, res) => {
  const advertisements = await Advertisement.find()
    .sort({ order: 1, createdAt: 1 })
    .lean();
  // Backfill `status` on documents written before the field existed, so the
  // admin UI always has a lifecycle to render.
  res.status(200).json({
    success: true,
    advertisements: advertisements.map((ad) => ({ ...ad, status: statusOf(ad) })),
  });
}, 'Failed to fetch advertisements');

// GET /advertisements/public — active ads only, ordered (for the client app).
exports.getPublicAdvertisements = asyncHandler(async (req, res) => {
  // isActive is kept in sync with status, so it alone is enough; the status
  // guard is belt-and-braces against a document edited outside this API.
  const advertisements = await Advertisement.find({
    isActive: true,
    status: { $ne: 'draft' },
  })
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

  // If the image is being replaced, clean up the old ImageKit file (best-effort).
  if (
    data.imageFileId !== undefined &&
    advertisement.imageFileId &&
    advertisement.imageFileId !== data.imageFileId
  ) {
    await imageKitService.deleteFile(advertisement.imageFileId);
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

  if (advertisement.imageFileId) {
    await imageKitService.deleteFile(advertisement.imageFileId);
  }

  await advertisement.deleteOne();
  await auditLog(req, 'advertisement_deleted', `Deleted ad "${adName(advertisement)}"`, {
    ...adTarget(advertisement),
    metadata: { targetName: adName(advertisement), status: advertisement.status },
  });
  res.status(200).json({ success: true, message: 'Advertisement deleted' });
}, 'Failed to delete advertisement');

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
