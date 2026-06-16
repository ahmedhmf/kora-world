import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsInt,
  IsEnum,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/,
    {
      message:
        'Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    },
  )
  password: string;

  @IsEnum(['admin', 'employee', 'supplier'], {
    message: 'Role must be one of admin, employee, or supplier',
  })
  @IsOptional()
  role?: string;

  @IsInt()
  @IsOptional()
  supplierId?: number;
}
