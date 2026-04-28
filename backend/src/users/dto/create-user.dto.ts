import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
