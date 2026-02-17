/**
 * Types for mfe-profile API
 */

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateUserRequest {
  id: number;
  data: Partial<Pick<User, 'name' | 'email' | 'avatar'>>;
}
