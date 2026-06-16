export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  supplierId?: number;
  createdAt?: string;
  updatedAt?: string;
  password?: string;
}

export interface CreateUserDto {
  email: string;
  name: string;
  role: string;
  supplierId?: number;
  password?: string;
}
