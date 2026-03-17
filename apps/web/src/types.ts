export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  createdAt?: number;
  updatedAt?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
