import { IsOptional, IsString, IsDateString } from 'class-validator';

export class QueryConsommablesDto {
  @IsOptional()
  @IsString()
  codeDepartement?: string;

  @IsOptional()
  @IsDateString()
  moisDebut?: string;

  @IsOptional()
  @IsDateString()
  moisFin?: string;

  @IsOptional()
  @IsString()
  semaineIntervention?: string;

  @IsOptional()
  @IsString()
  nomTechnicien?: string;

  @IsOptional()
  @IsString()
  nomSociete?: string;

  @IsOptional()
  @IsString()
  groupBy?: 'mois' | 'semaine' | 'departement' | 'technicien';
}

export class UpdateFormuleDto {
  @IsOptional()
  multiplicateur?: number;

  @IsOptional()
  multiplicateurNok?: number;

  @IsOptional()
  minimumQte?: number;

  @IsOptional()
  actif?: boolean;
}

export class AnalyseConsommablesDto {
  @IsOptional()
  @IsString()
  groupBy?: 'departement' | 'mois' | 'semaine' | 'operateur' | 'typezone' | 'infrastructure' | 'typeAbonne' | 'activite';

  @IsOptional()
  @IsString()
  produitId?: string;

  @IsOptional()
  @IsDateString()
  moisDebut?: string;

  @IsOptional()
  @IsDateString()
  moisFin?: string;

  @IsOptional()
  @IsString()
  codeDepartement?: string;

  @IsOptional()
  @IsString()
  operateur?: string;
}

export class CommandesArticlesDto {
  @IsOptional()
  @IsDateString()
  moisDebut?: string;

  @IsOptional()
  @IsDateString()
  moisFin?: string;
}
