import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/,
    {
      message:
        'New password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    },
  )
  newPassword: string;
}
