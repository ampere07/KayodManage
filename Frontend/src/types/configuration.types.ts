export interface Profession {
  _id: string;
  name: string;
  icon?: string;
  categoryId: string;
  isQuickAccess?: boolean;
  quickAccessOrder?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface JobCategory {
  _id: string;
  name: string;
  icon?: string;
  professions: Profession[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateJobCategoryRequest {
  name: string;
  icon?: string;
}

export interface CreateProfessionRequest {
  name: string;
  categoryId: string;
}

export interface UpdateJobCategoryRequest {
  name?: string;
  icon?: string;
}

export interface UpdateProfessionRequest {
  name: string;
}

export interface JobCategoriesResponse {
  success: boolean;
  categories: JobCategory[];
}

export interface JobCategoryResponse {
  success: boolean;
  category: JobCategory;
}
