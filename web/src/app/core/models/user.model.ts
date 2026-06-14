export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
  password?: string;
}

export interface CreateUserDto {
  email: string;
  name: string;
  role: string;
  password?: string;
}
