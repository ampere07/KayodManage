const mongoose = require('mongoose');
const { Schema } = mongoose;

// Mirrors kayod/server/src/models/Draft.js — same shared 'drafts' collection,
// no API boundary between the two apps (see Job.js in this same directory).
const DraftSchema = new Schema({
  title: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  professionName: { type: String, default: null },
  icon: { type: String, default: '' },
  media: { type: [String], default: [] },
  videos: { type: [Schema.Types.Mixed], default: [] },
  video: { type: Schema.Types.Mixed, default: undefined },
  location: { type: Schema.Types.Mixed, default: null },
  locationDetails: { type: String, trim: true, default: '' },
  date: { type: Date, default: null },
  selectedDates: { type: [Date], default: [] },
  timeWindows: { type: [String], default: [] },
  dateDetails: { type: Schema.Types.Mixed, default: null },
  isUrgent: { type: Boolean, default: false },
  serviceTier: { type: String, enum: ['standard', 'premium', 'economy'], default: 'standard' },
  paymentMethod: { type: String, enum: ['wallet'], default: 'wallet' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  publishedJobId: { type: Schema.Types.ObjectId, ref: 'Job', default: null },
  // Set when this draft was created by reverting an existing job (manual
  // revert-to-draft, or a "Refund Client" dispute resolution).
  sourceJobId: { type: Schema.Types.ObjectId, ref: 'Job', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

DraftSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

DraftSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Draft', DraftSchema, 'drafts');
