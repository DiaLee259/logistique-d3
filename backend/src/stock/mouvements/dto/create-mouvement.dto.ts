import { IsString, IsEnum, IsInt, IsOptional, IsBoolean, IsNumber, IsDateString, Min } from 'class-validator';
import { TypeMouvement, ProdSav } from '@prisma/client';

export class CreateMouvementDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  articleId: string;

  @IsString()
  entrepotId: string;

  @IsEnum(TypeMouvement)
  type: TypeMouvement;

  @IsInt()
  @Min(1)
  quantiteDemandee: number;

  @IsInt()
  @Min(0)
  quantiteFournie: number;

  @IsString()
  @IsOptional()
  departement?: string;

  @IsString()
  @IsOptional()
  numeroCommande?: string;

  @IsString()
  @IsOptional()
  numeroOperation?: string;

  @IsString()
  @IsOptional()
  sourceDestination?: string;

  @IsEnum(ProdSav)
  @IsOptional()
  prodSav?: ProdSav;

  @IsString()
  @IsOptional()
  commentaire?: string;

  @IsString()
  @IsOptional()
  adresseMail?: string;

  @IsString()
  @IsOptional()
  manager?: string;

  @IsString()
  @IsOptional()
  infoSupplementaire?: string;

  @IsString()
  @IsOptional()
  adresse?: string;

  @IsNumber()
  @IsOptional()
  cout?: number;

  @IsString()
  @IsOptional()
  commandeId?: string;
}
