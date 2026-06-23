import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsInt,
  IsEnum,
  Matches,
} from 'class-validator';

export class UpdateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/, {
    message:
      'Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
  })
  password?: string;

  @IsEnum(['admin', 'employee', 'supplier'], {
    message: 'Role must be one of admin, employee, or supplier',
  })
  @IsOptional()
  role?: string;

  @IsInt()
  @IsOptional()
  supplierId?: number;
}
