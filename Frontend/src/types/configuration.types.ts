import type { ServiceClassId } from '../constants/serviceClasses';

export interface Profession {
  _id: string;
  name: string;
  icon?: string;
  categoryId: string;
  /** Overrides the parent category's class. `null`/absent means inherit. */
  serviceClass?: ServiceClassId | null;
  isQuickAccess?: boolean;
  quickAccessOrder?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface JobCategory {
  _id: string;
  name: string;
  icon?: string;
  /** How long jobs in this category hold payment after completion. */
  serviceClass?: ServiceClassId;
  professions: Profession[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateJobCategoryRequest {
  name: string;
  icon?: string;
  serviceClass?: ServiceClassId;
}

export interface CreateProfessionRequest {
  name: string;
  categoryId: string;
  serviceClass?: ServiceClassId | null;
}

export interface UpdateJobCategoryRequest {
  name?: string;
  icon?: string;
  serviceClass?: ServiceClassId;
}

export interface UpdateProfessionRequest {
  name?: string;
  icon?: string;
  serviceClass?: ServiceClassId | null;
}

export interface JobPostingSettings {
  maxActiveJobsPerUser: number;
  jobPostDurationDays: number;
  asapFee: number;
  bookingFeePercentage: number;
  bookingFeeThreshold: number;
  bookingFeeMinimum: number;
  clientCancellationFeePercentage: number;
  clientCancellationFeeMinimum: number;
  providerStrikeLimit: number;
  providerStrikeRatingPenalty: number;
  requireApproval: boolean;
  allowAttachments: boolean;
  maxAttachments: number;
  updatedAt?: Date | string;
  updatedBy?: string;
}

export type UpdateJobPostingSettingsRequest = Partial<
  Omit<JobPostingSettings, 'updatedAt' | 'updatedBy'>
>;

export interface JobPostingSettingsResponse {
  success: boolean;
  settings: JobPostingSettings;
}

// Mirrors the Kayod client design system (PromoBanner): 'invite' & 'offer'
// styled banners, plus 'image' for uploaded banners.
export type AdvertisementType = 'invite' | 'offer' | 'image';

export type AdOverlayKind = 'text' | 'button';
export type AdOverlayPosition =
  | 'top-left'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-right';

// A text or button element overlaid on an image ad.
export interface AdOverlay {
  id?: string;
  kind: AdOverlayKind;
  text: string;
  color: string;
  bgColor?: string;
  position: AdOverlayPosition;
}

// Lifecycle shown to admins. `isActive` mirrors it (published <=> active) and
// stays the field the client app filters on.
export type AdStatus = 'draft' | 'published' | 'paused';

export interface Advertisement {
  _id: string;
  type: AdvertisementType;
  title: string;
  subtitle: string;
  highlight: string;
  ctaLabel: string;
  /** The banner itself for 'image' ads; an optional background photo for 'invite' / 'offer'. */
  imageUrl: string;
  imageFileId: string;
  overlays: AdOverlay[];
  linkAction: string;
  status: AdStatus;
  isActive: boolean;
  order: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type AdvertisementInput = Partial<
  Omit<Advertisement, '_id' | 'createdAt' | 'updatedAt'>
>;

export interface JobCategoriesResponse {
  success: boolean;
  categories: JobCategory[];
}

export interface JobCategoryResponse {
  success: boolean;
  category: JobCategory;
}
