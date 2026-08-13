const mongoose = require('mongoose');
const { SERVICE_CLASS_IDS, DEFAULT_SERVICE_CLASS } = require('../config/serviceClasses');

const professionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  icon: {
    type: String,
    trim: true,
  },
  // Optional override of the parent category's service class. `null` means
  // "inherit" — the override lets a category that is broadly one class hold an
  // exception without being split in two.
  serviceClass: {
    type: String,
    enum: [...SERVICE_CLASS_IDS, null],
    default: null,
  },
  isQuickAccess: {
    type: Boolean,
    default: false,
  },
  quickAccessOrder: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const jobCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  icon: {
    type: String,
    trim: true,
  },
  // How long a completed job in this category holds the client's payment before
  // the provider is paid — see app/config/serviceClasses.js. Defaults to
  // `standard` (the historical 5-day warranty) so pre-existing categories are
  // unchanged.
  serviceClass: {
    type: String,
    enum: SERVICE_CLASS_IDS,
    default: DEFAULT_SERVICE_CLASS,
  },
  professions: [professionSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

jobCategorySchema.index({ 'professions._id': 1 });

jobCategorySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('JobCategory', jobCategorySchema, 'jobcategories');
