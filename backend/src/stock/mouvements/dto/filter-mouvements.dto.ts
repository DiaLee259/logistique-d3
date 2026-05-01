import { IsOptional, IsString } from 'class-validator';

export class FilterMouvementsDto {
  @IsOptional() @IsString() dateDebut?: string;
  @IsOptional() @IsString() dateFin?: string;
  @IsOptional() @IsString() mois?: string;
  @IsOptional() @IsString() entrepotId?: string;
  @IsOptional() @IsString() articleId?: string;
  @IsOptional() @IsString() departement?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() envoye?: string;
  @IsOptional() @IsString() recu?: string;
  @IsOptional() @IsString() manager?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}
