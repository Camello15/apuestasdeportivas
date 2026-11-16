import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(15)
  @MaxLength(256)
  password!: string;

  @IsBoolean()
  ageDeclared!: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  captchaToken!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;
}

export class ResendEmailVerificationDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
