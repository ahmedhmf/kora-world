export interface DropdownOption {
  id: number;
  category: string;
  value: string;
}

export interface CreateDropdownOptionDto {
  category: string;
  value: string;
}
