import { IsString, IsOptional, IsInt, IsBoolean, IsNumber, Min } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  reference: string;

  @IsString()
  nom: string;

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

  @IsString()
  @IsOptional()
  regleConsommation?: string;

  @IsNumber()
  @IsOptional()
  facteurConsommation?: number;
}
