const mongoose = require('mongoose');

// Daily view and tap counts per advertisement and placement. Written by the
// Kayod app (kayod/server models/AdvertisementStat.js, same collection) when an
// ad is seen or tapped; read here for each ad's performance.
const advertisementStatSchema = new mongoose.Schema(
  {
    advertisement: { type: mongoose.Schema.Types.ObjectId, ref: 'Advertisement', required: true },
    day: { type: String, required: true }, // 'YYYY-MM-DD', Philippine time
    placement: { type: String, required: true },
    views: { type: Number, default: 0 },
    taps: { type: Number, default: 0 },
  },
  { timestamps: true }
);

advertisementStatSchema.index({ advertisement: 1, day: 1, placement: 1 }, { unique: true });

module.exports = mongoose.model('AdvertisementStat', advertisementStatSchema, 'advertisementstats');
