/**
 * User Types
 * Type definitions for user-related data structures
 */

export type UserType = 'client' | 'provider' | 'admin' | 'superadmin';
export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'banned';
export type RestrictionType = 'restricted' | 'suspended' | 'banned';

export interface RestrictionDetails {
  type: RestrictionType;
  reason: string;
  restrictedAt: Date;
  suspendedUntil?: Date;
  expiresAt?: Date;
  appealAllowed: boolean;
  restrictedBy?: string | {
    _id: string;
    name: string;
  };
}

export interface UserWallet {
  balance: number;
  availableBalance: number;
  heldBalance: number;
  currency: string;
  isActive: boolean;
  isVerified: boolean;
}

export interface UserFee {
  _id: string;
  amount: number;
  dueDate: Date;
  isPaid: boolean;
  status: string;
  paymentMethod?: string;
  createdAt: Date;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  categories: string[];
  userType?: UserType;
  profileImage?: string;
  profileImagePublicId?: string;
  isVerified: boolean;
  isRestricted: boolean;
  isOnline: boolean;
  dateOfBirth?: string;
  accountStatus?: AccountStatus;
  restrictionDetails?: RestrictionDetails;
  wallet: UserWallet;
  fees: UserFee[];
  createdAt: Date;
  lastLogin?: Date;
}

export interface UserStats {
  totalUsers: number;
  onlineUsers: number;
  verifiedUsers: number;
  restrictedUsers: number;
}

export interface VerificationDetails {
  verifiedBy?: {
    _id: string;
    name: string;
  };
  verifiedAt?: Date;
}

export interface PenaltyData {
  totalPenalties: number;
  activeWarnings: number;
  lastPenalty: Date | null;
}

export interface UsersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  userType?: 'client' | 'provider';
  restricted?: string;
}

export interface UsersResponse {
  users: User[];
  stats?: UserStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface UserDetailsResponse extends User {}

export interface UserActionRequest {
  reason?: string;
  duration?: number;
  verified?: boolean;
  restricted?: boolean;
}

export interface UserActionResponse extends User {}
