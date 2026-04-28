import { IsString, IsOptional, IsInt, IsBoolean, IsNumber, Min } from 'class-validator';

export class UpdateArticleDto {
  @IsString()
  @IsOptional()
  nom?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  unite?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  seuilAlerte?: number;

  @IsBoolean()
  @IsOptional()
  actif?: boolean;

  @IsString()
  @IsOptional()
  regleConsommation?: string;

  @IsNumber()
  @IsOptional()
  facteurConsommation?: number;
}
