const Advertisement = require('../models/Advertisement');
const imageKitService = require('../services/imageKitService');

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

// GET /advertisements — admin: all ads, ordered.
exports.getAdvertisements = async (req, res) => {
  try {
    const advertisements = await Advertisement.find()
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.status(200).json({ success: true, advertisements });
  } catch (error) {
    console.error('Error fetching advertisements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advertisements',
      error: error.message,
    });
  }
};

// GET /advertisements/public — active ads only, ordered (for the client app).
exports.getPublicAdvertisements = async (req, res) => {
  try {
    const advertisements = await Advertisement.find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.status(200).json({ success: true, advertisements });
  } catch (error) {
    console.error('Error fetching public advertisements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advertisements',
      error: error.message,
    });
  }
};

// POST /advertisements — create a new ad.
exports.createAdvertisement = async (req, res) => {
  try {
    const data = pickEditable(req.body);

    if (data.type === 'image' && !data.imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'An image ad requires an uploaded image',
      });
    }

    // New ads go to the end of the carousel unless an order was provided.
    if (data.order === undefined) {
      const last = await Advertisement.findOne().sort({ order: -1 }).lean();
      data.order = last ? (last.order || 0) + 1 : 0;
    }

    const advertisement = await Advertisement.create(data);
    res.status(201).json({ success: true, advertisement });
  } catch (error) {
    console.error('Error creating advertisement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create advertisement',
      error: error.message,
    });
  }
};

// PATCH /advertisements/:id — update an ad.
exports.updateAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    const advertisement = await Advertisement.findById(id);
    if (!advertisement) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    const data = pickEditable(req.body);

    // If the image is being replaced, clean up the old ImageKit file (best-effort).
    if (
      data.imageFileId !== undefined &&
      advertisement.imageFileId &&
      advertisement.imageFileId !== data.imageFileId
    ) {
      await imageKitService.deleteFile(advertisement.imageFileId);
    }

    Object.assign(advertisement, data);
    await advertisement.save();

    res.status(200).json({ success: true, advertisement });
  } catch (error) {
    console.error('Error updating advertisement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update advertisement',
      error: error.message,
    });
  }
};

// DELETE /advertisements/:id — delete an ad (and its uploaded image, if any).
exports.deleteAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    const advertisement = await Advertisement.findById(id);
    if (!advertisement) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }

    if (advertisement.imageFileId) {
      await imageKitService.deleteFile(advertisement.imageFileId);
    }

    await advertisement.deleteOne();
    res.status(200).json({ success: true, message: 'Advertisement deleted' });
  } catch (error) {
    console.error('Error deleting advertisement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete advertisement',
      error: error.message,
    });
  }
};

// POST /advertisements/upload-image — upload a banner image, returns { url, fileId }.
exports.uploadAdvertisementImage = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error uploading advertisement image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message,
    });
  }
};
