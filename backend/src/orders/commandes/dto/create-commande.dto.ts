import { IsString, IsOptional, IsInt, IsEmail, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class LigneCommandeDto {
  @IsString()
  articleId: string;

  @IsInt()
  @Min(1)
  quantiteDemandee: number;

  @IsString()
  @IsOptional()
  commentaire?: string;
}

export class CreateCommandeDto {
  @IsString()
  departement: string;

  @IsString()
  @IsOptional()
  demandeur?: string;

  @IsEmail()
  @IsOptional()
  emailDemandeur?: string;

  @IsString()
  @IsOptional()
  societe?: string;

  @IsString()
  @IsOptional()
  interlocuteur?: string;

  @IsString()
  @IsOptional()
  manager?: string;

  @IsInt()
  @IsOptional()
  nombreGrilles?: number;

  @IsString()
  @IsOptional()
  typeGrille?: string;

  @IsString()
  @IsOptional()
  dateCommande?: string;

  @IsString()
  @IsOptional()
  commentaire?: string;

  @IsString()
  @IsOptional()
  fichierExcelUrl?: string;

  @IsString()
  @IsOptional()
  telephoneDestinataire?: string;

  @IsString()
  @IsOptional()
  adresseLivraison?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LigneCommandeDto)
  lignes: LigneCommandeDto[];
}
