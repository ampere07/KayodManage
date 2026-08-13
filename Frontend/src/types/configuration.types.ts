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

export interface JobCategoriesResponse {
  success: boolean;
  categories: JobCategory[];
}

export interface JobCategoryResponse {
  success: boolean;
  category: JobCategory;
}
