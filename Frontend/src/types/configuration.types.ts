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
  clientCancellationFeeThreshold: number;
  clientCancellationDayOfFeePercentage: number;
  clientCancellationDayOfFeeMinimum: number;
  providerStrikeLimit: number;
  providerStrikeRatingPenalty: number;
  noShowReviewWindowHours: number;
  noShowReviewReminderHours: number;
  noShowPayoutPercentage: number;
  noShowPayoutMinimum: number;
  noShowPayoutHoldHours: number;
  noShowLapseRestrictionCount: number;
  confirmedFaultRestrictionCount: number;
  disputeLossRestrictionCount: number;
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

// ─── Legal Documents ─────────────────────────────────────────────────────────
//
// The five executed agreements shown in the Kayod app: the Terms of Use, the
// two role addenda, Schedule A, and the Privacy Policy. Stored server-side and
// editable here; the app also ships a bundled copy of the same text so the
// screens render offline and before the API answers.
//
// The block union mirrors client/src/config/legal/blocks.js and the validator
// in Backend/app/controllers/legalController.js. All three have to agree: a
// block type the renderer does not know renders as nothing, which on a legal
// screen means a clause quietly disappearing.

export interface LegalParagraphBlock {
  type: 'p';
  text: string;
}

/** Numbered sub-clauses. Rendered "{section}.{n}" from the section's number. */
export interface LegalClausesBlock {
  type: 'clauses';
  items: string[];
}

/** Unnumbered enumeration under a lead-in — sub-items of a clause, not clauses. */
export interface LegalBulletsBlock {
  type: 'bullets';
  items: string[];
}

export interface LegalSubBlock {
  type: 'sub';
  title: string;
  blocks: LegalBlock[];
}

export interface LegalTableBlock {
  type: 'table';
  head: string[];
  rows: string[][];
}

export type LegalBlock =
  | LegalParagraphBlock
  | LegalClausesBlock
  | LegalBulletsBlock
  | LegalSubBlock
  | LegalTableBlock;

export type LegalBlockType = LegalBlock['type'];

export interface LegalSection {
  /** Stable slug. Deep-link target — renaming it breaks links into the clause. */
  id: string;
  /** Section number as printed. 0 means unnumbered (the Provider Agreement recitals). */
  number: number;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  _id: string;
  documentId: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  intro: string;
  sections: LegalSection[];
  /** The version an acceptance of this text is recorded against. */
  version: string;
  /** The shipped version this record was seeded from. Diverges once edited. */
  sourceVersion: string;
  revision: number;
  lastUpdatedLabel: string;
  updatedAt?: Date | string;
  updatedBy?: string;
}

export type UpdateLegalDocumentRequest = Partial<
  Pick<LegalDocument, 'title' | 'shortTitle' | 'subtitle' | 'intro' | 'sections' | 'version'>
>;

export interface LegalDocumentsResponse {
  success: boolean;
  documents: LegalDocument[];
  sourceVersion: string;
}
