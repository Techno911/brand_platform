import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshDto {
  // Refresh приоритетно берётся из httpOnly cookie; тело оставлено для backwards-compat
  // с уже деплоенным фронтом, но теперь опционально — чистый cookie-flow тоже проходит.
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
