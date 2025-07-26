import mongoose, { Schema, Document } from 'mongoose';

export interface IJob extends Document {
  _id: string;
  title: string;
  description: string;
  category: string;
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  location: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  clientId: mongoose.Types.ObjectId | any;
  providerId?: mongoose.Types.ObjectId | any;
  paymentMethod: 'wallet' | 'cash' | 'xendit';
  applications: Array<{
    providerId: mongoose.Types.ObjectId;
    quote: number;
    coverLetter: string;
    status: 'pending' | 'accepted' | 'rejected';
    submittedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const JobSchema = new Schema<IJob>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  budget: {
    min: {
      type: Number,
      required: true,
      min: 0
    },
    max: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'completed', 'cancelled'],
    default: 'open'
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  providerId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'cash', 'xendit'],
    required: true
  },
  applications: [{
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    quote: {
      type: Number,
      required: true,
      min: 0
    },
    coverLetter: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }],
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
JobSchema.index({ status: 1 });
JobSchema.index({ category: 1 });
JobSchema.index({ clientId: 1 });
JobSchema.index({ providerId: 1 });
JobSchema.index({ createdAt: -1 });

export default mongoose.model<IJob>('Job', JobSchema);