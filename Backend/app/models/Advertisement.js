const mongoose = require('mongoose');

// A text or button element overlaid on an image ad, anchored to a corner/center.
const overlaySchema = new mongoose.Schema({
  id: { type: String, default: '' }, // client-side key
  kind: { type: String, enum: ['text', 'button'], default: 'text' },
  text: { type: String, trim: true, default: '' },
  color: { type: String, trim: true, default: '#FFFFFF' }, // text color
  bgColor: { type: String, trim: true, default: '#E37F0D' }, // button background
  position: {
    type: String,
    enum: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    default: 'bottom-left',
  },
}, { _id: false });

// An advertisement shown in the Kayod client home screen promo carousel.
// Variants mirror the Kayod client design system (kayod/client PromoBanner):
//   - 'invite': referral banner (teal #0D6E6E, two-line title, orange CTA) — InviteBanner
//   - 'offer' : discount banner (peach #ffead1, orange title/discount)      — OfferBanner
//   - 'image' : a full-bleed uploaded image banner (stored on ImageKit)
// Colors/layout are dictated by the design system; admins customize the content.
const advertisementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['invite', 'offer', 'image'],
    default: 'offer',
  },
  // Content fields (map to PromoBanner props)
  title: { type: String, trim: true, default: '' }, // invite: line 1 / offer: title
  subtitle: { type: String, trim: true, default: '' }, // offer: description
  highlight: { type: String, trim: true, default: '' }, // invite: line 2 / offer: discount (e.g. "20% off")
  ctaLabel: { type: String, trim: true, default: '' }, // button label e.g. "Refer Now", "Post a Job"
  // Image fields
  imageUrl: { type: String, trim: true, default: '' },
  imageFileId: { type: String, trim: true, default: '' }, // ImageKit fileId (for deletion)
  // Text/button elements overlaid on an image ad.
  overlays: { type: [overlaySchema], default: [] },
  // Optional deep link / action fired when the banner is tapped in the client.
  linkAction: { type: String, trim: true, default: '' },
  // Presentation
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

advertisementSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Advertisement', advertisementSchema, 'advertisements');
