export interface Profession {
  _id: string;
  name: string;
  categoryId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface JobCategory {
  _id: string;
  name: string;
  professions: Profession[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateJobCategoryRequest {
  name: string;
}

export interface CreateProfessionRequest {
  name: string;
  categoryId: string;
}

export interface UpdateJobCategoryRequest {
  name: string;
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
