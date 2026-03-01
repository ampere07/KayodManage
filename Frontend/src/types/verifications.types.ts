/**
 * Verification Types
 * Type definitions for verification-related data structures
 */

export interface UserInfo {
  _id: string;
  name: string;
  email: string;
  userType: string;
  profileImage?: string;
  createdAt?: string;
}

export interface VerificationDocument {
  cloudinaryUrl: string;
  publicId: string;
  uploadedAt: string;
  originalName?: string;
  type?: string;
}

export type VerificationStatus = 'approved' | 'rejected' | 'pending' | 'under_review' | 'resubmission_requested' | 'flagged';

export interface Verification {
  _id: string;
  userId: UserInfo;
  faceVerification: VerificationDocument[] | VerificationDocument;
  validId: (VerificationDocument & { type: string })[] | (VerificationDocument & { type: string });
  credentials: VerificationDocument[];
  status: VerificationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: UserInfo;
  adminNotes?: string;
  rejectionReason?: string;
  verificationAttempts: number;
}

export interface VerificationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  under_review: number;
}

export interface VerificationsQueryParams {
  status?: string;
  limit?: number;
  skip?: number;
}

export interface VerificationsResponse {
  success: boolean;
  data: Verification[];
}

export interface VerificationDetailsResponse {
  success: boolean;
  data: Verification;
}

export interface UpdateVerificationStatusRequest {
  status: VerificationStatus;
  adminNotes?: string;
  rejectionReason?: string;
  banUser?: boolean;
}

export interface UpdateVerificationStatusResponse {
  success: boolean;
  message: string;
  data: Verification;
}

export interface UserImages {
  userId: string;
  images: {
    faceVerification: VerificationDocument[] | VerificationDocument;
    validId: (VerificationDocument & { type: string })[] | (VerificationDocument & { type: string });
    credentials: VerificationDocument[];
  };
}

export interface UserImagesResponse {
  success: boolean;
  data: UserImages;
}

export interface VerificationStatsResponse {
  success: boolean;
  data: VerificationStats;
}
