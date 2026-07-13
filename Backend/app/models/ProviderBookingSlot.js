const mongoose = require('mongoose');
const { Schema } = mongoose;

// Mirrors kayod/server/src/models/ProviderBookingSlot.js — same shared
// 'providerbookingslots' collection. Admin-side cancellation paths
// (forceCancelJob, resolveDispute's refund_client outcome) must release a
// job's claimed slot the same way the real client-side cancelBooking does,
// or the provider's date+window stays incorrectly locked forever even
// though the booking never happened.
const ProviderBookingSlotSchema = new Schema(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dateKey: { type: String, required: true },
    windowKey: { type: String, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  },
  { timestamps: true },
);

ProviderBookingSlotSchema.statics.releaseForJob = function (jobId, session = null) {
  return this.deleteMany({ jobId }).session(session || null);
};

module.exports = mongoose.model('ProviderBookingSlot', ProviderBookingSlotSchema, 'providerbookingslots');
