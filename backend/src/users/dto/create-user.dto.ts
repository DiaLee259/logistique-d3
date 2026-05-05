import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator';
import { ROLES } from '../../config/roles.config';

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

  @IsIn(ROLES)
  @IsOptional()
  role?: string;
}
