import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';

// ── Mapping colonnes Excel → champs DB ────────────────────────────────────────

const INTERVENTION_COLS: Record<string, string[]> = {
  idInterventionIw:    ['ID intervention IW', 'Identifiant IW', 'ID IW', 'N° IW'],
  idInterventionGrdv:  ['ID intervention GRDV', 'Identifiant GRDV', 'ID GRDV', 'N° GRDV'],
  idTechnicienCas:     ['ID technicien CAS', 'Id technicien CAS', 'Identifiant technicien'],
  nomTechnicien:       ['Paramètre.Tech', 'Parametre.Tech', 'Technicien'],
  nomSociete:          ['Paramètre.Nom de la sociètèe', 'Parametre.Nom de la societe', 'Paramètre.Nom de la société'],
  codeDepartement:     ['Code département NRO', 'Code departement NRO', 'Code NRO'],
  departement:         ['Département NRO', 'Departement NRO'],
  dateIntervention:    ['Date intervention', "Date d'intervention"],
  moisIntervention:    ['Mois intervention', "Mois d'intervention"],
  semaineIntervention: ['Semaine intervention', "Semaine d'intervention"],
  technologie:         ['Technologie'],
  infrastructure:      ['Infrastructure'],
  operateur:           ['Opérateur exploitant', 'Operateur exploitant', 'Opérateur'],
  typeAbonne:          ['Type abonné', 'Type abonne'],
  modeleModem:         ['Modèle modem', 'Modele modem'],
  typezone:            ['Typezone'],
  activites:           ['Activités', 'Activites', 'Activité', 'Activite'],
  typePresta:          ['Type de presta', 'Type presta'],
  etat:                ['État', 'Etat', 'état'],
  codeCloture:         ['Code clôture', 'Code cloture'],
  categorieEchec:      ["Catégorie d'échec", "Categorie d'echec"],
  aboRacco110:         ['AboRacco – 110 - Statut PTO et CAB avant travaux ?', 'AboRacco – 110', 'AboRacco - 110'],
  aboRacco120:         ['AboRacco – 120 - Blocage lors travaux PTO et CAB ?', 'AboRacco – 120', 'AboRacco - 120'],
  // Colonnes de filtrage — seules les lignes éch ues et non annulées sont importées
  estEchu:             ['Est échue ?', 'Est echu ?', 'Est échue', 'Est echou', 'Echue'],
  estAnnule:           ['Est annulée ?', 'Est annule ?', 'Est annulée', 'Annulee'],
};

const TECH_COLS: Record<string, string[]> = {
  // Paramètre.xlsx: colonne "ID CAS" (17e col)
  idCas:         ['ID CAS', 'ID technicien CAS', 'Id technicien CAS', 'ID technicien',
                  'Id technicien', 'idCas', 'ID_TECH', 'id_tech', 'Identifiant technicien'],
  // Paramètre.xlsx: colonne "Tech" (2e col)
  nomTechnicien: ['Tech', 'Nom technicien', 'Nom', 'Technicien', 'Paramètre.Tech',
                  'NOM_TECH', 'nom_tech', 'Prénom et nom', 'Prenom et nom', 'Nom complet'],
  // Paramètre.xlsx: colonne "Nom de la sociètèe" (14e col, typo volontaire du fichier source)
  nomSociete:    ['Nom de la sociètèe', 'Nom de la société', 'Société', 'Societe',
                  'Nom société', 'Nom societe', 'NOM_SOC', 'nom_soc', 'Entreprise',
                  'Paramètre.Nom de la société', 'Paramètre.Nom de la sociètèe'],
};

const NULL_STRINGS = new Set([
  '', 'null', 'undefined', 'nan', 'NaN', 'None', 'none',
  '#REF!', '#N/A', '#VALEUR!', '#VALUE!', '#NOM?', '#NAME?',
]);

const CHUNK_SIZE = 500;

// IDs d'imports dont l'annulation a été demandée
const pendingCancels = new Set<string>();

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ConsommablesImportService {
  private readonly logger = new Logger(ConsommablesImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private cellStr(cell: ExcelJS.Cell): string | null {
    const val = cell.value;
    if (val === null || val === undefined) return null;

    let str: string;
    if (val instanceof Date) {
      str = val.toISOString();
    } else if (typeof val === 'object') {
      if ('result' in val)   str = String((val as any).result ?? '');
      else if ('richText' in val) str = (val as any).richText.map((r: any) => r.text).join('');
      else if ('text' in val)    str = String((val as any).text ?? '');
      else str = String(val);
    } else {
      str = String(val);
    }

    str = str.trim();
    return NULL_STRINGS.has(str) ? null : str;
  }

  private parseBigInt(s: string | null): bigint | null {
    if (!s) return null;
    const n = Number(s.replace(/[^\d-]/g, ''));
    return isNaN(n) ? null : BigInt(Math.round(n));
  }

  private parseDate(s: string | null): Date | null {
    if (!s) return null;
    if (s.includes('T')) return new Date(s);  // ISO from ExcelJS
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  private parseMois(s: string | null): Date | null {
    if (!s) return null;
    if (/^\d{4}-\d{2}$/.test(s)) {
      const d = new Date(s + '-01T00:00:00Z');
      return isNaN(d.getTime()) ? null : d;
    }
    return this.parseDate(s);
  }

  private parseBoolean(s: string | null): boolean | null {
    if (!s) return null;
    const l = s.toLowerCase().trim();
    if (['1', 'true', 'vrai', 'oui', 'yes'].includes(l)) return true;
    if (['0', 'false', 'faux', 'non', 'no'].includes(l)) return false;
    return null;
  }

  private findCols(headers: string[], map: Record<string, string[]>): Record<string, number> {
    const idx: Record<string, number> = {};
    for (const [field, candidates] of Object.entries(map)) {
      for (const c of candidates) {
        const i = headers.findIndex(h => h.toLowerCase().trim() === c.toLowerCase().trim());
        if (i !== -1) { idx[field] = i; break; }
      }
    }
    return idx;
  }

  private async loadWb(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    return wb;
  }

  // ── Import Interventions ──────────────────────────────────────────────────────

  async startInterventionsImport(
    file: Express.Multer.File,
    force = false,
  ): Promise<{ importId: string; statut: string }> {
    // Doublon check
    if (!force) {
      const dup = await this.prisma.importConsommableLog.findFirst({
        where: { nomFichier: file.originalname, statut: 'SUCCES' },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(
          `"${file.originalname}" a déjà été importé avec succès. ` +
          `Ajoutez ?force=true pour forcer le ré-import.`,
        );
      }
    }

    const log = await this.prisma.importConsommableLog.create({
      data: { id: uuidv4(), nomFichier: file.originalname, statut: 'EN_COURS' },
    });

    const buffer = file.buffer;
    setImmediate(() => {
      this.runInterventionsImport(buffer, log.id, file.originalname).catch(err => {
        this.logger.error(`Import ${file.originalname} échoué :`, err);
        this.prisma.importConsommableLog
          .update({
            where: { id: log.id },
            data: { statut: 'ECHEC', erreurs: [{ message: String(err?.message ?? err) }] as any },
          })
          .catch(() => {});
      });
    });

    return { importId: log.id, statut: 'EN_COURS' };
  }

  private async runInterventionsImport(buffer: Buffer, importId: string, filename: string) {
    const t0 = Date.now();
    let nbTotal = 0, nbImportees = 0, nbErreurs = 0;
    let periodeDebut: Date | null = null, periodeFin: Date | null = null;
    const errors: { ligne: number; message: string }[] = [];

    // Charger la feuille
    const wb = await this.loadWb(buffer);
    const sheet = wb.getWorksheet('INTERVENTIONS TECHNO SMART')
               ?? wb.getWorksheet('INTERVENTION TECHNO SMART')
               ?? wb.worksheets[0];
    if (!sheet) throw new Error('Aucune feuille trouvée dans le fichier');

    // En-têtes
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = String(cell.value ?? '').trim();
    });

    const colIdx = this.findCols(headers, INTERVENTION_COLS);
    this.logger.log(`Colonnes détectées : ${Object.keys(colIdx).join(', ')}`);

    // Référentiel techniciens (lookup rapide)
    const techRefs = await this.prisma.technicienRef.findMany({ select: { idCas: true, nomTechnicien: true, nomSociete: true } });
    const techMap = new Map<bigint, { nom: string; soc: string | null }>();
    for (const r of techRefs) techMap.set(r.idCas, { nom: r.nomTechnicien, soc: r.nomSociete });

    // Traitement ligne par ligne
    let batch: any[] = [];

    const flush = async (): Promise<boolean> => {
      if (!batch.length) return false;
      try {
        await this.prisma.interventionTerrain.createMany({ data: batch });
        nbImportees += batch.length;
      } catch (err) {
        nbErreurs += batch.length;
        if (errors.length < 50) errors.push({ ligne: nbTotal, message: String(err?.message ?? err).slice(0, 200) });
      }
      batch = [];
      // Vérifier si l'annulation a été demandée
      if (pendingCancels.has(importId)) {
        pendingCancels.delete(importId);
        return true; // signal d'arrêt
      }
      return false;
    };

    const totalRows = sheet.rowCount;
    for (let rowNum = 2; rowNum <= totalRows; rowNum++) {
      const row = sheet.getRow(rowNum);
      nbTotal++;

      const get = (f: string) => colIdx[f] !== undefined ? this.cellStr(row.getCell(colIdx[f] + 1)) : null;

      // ── Filtres obligatoires ─────────────────────────────────────────────────
      const estEchu   = this.parseBoolean(get('estEchu'));
      const estAnnule = this.parseBoolean(get('estAnnule'));
      if (estEchu !== true) continue;    // ne garder que les interventions échues
      if (estAnnule === true) continue;  // exclure les annulées

      const typezone  = get('typezone');
      const activites = get('activites');
      const etat      = get('etat');
      const idTechStr = get('idTechnicienCas');

      // Ignorer les lignes totalement vides
      if (!typezone && !activites && !etat && !idTechStr && !get('operateur')) continue;

      const idTechnicienCas = this.parseBigInt(idTechStr);
      const techRef = idTechnicienCas ? techMap.get(idTechnicienCas) : null;

      const nomTechnicien = get('nomTechnicien') ?? techRef?.nom ?? null;
      const nomSociete    = get('nomSociete')    ?? techRef?.soc ?? null;

      const mois  = this.parseMois(get('moisIntervention'));
      const dateI = this.parseDate(get('dateIntervention'));

      if (mois) {
        if (!periodeDebut || mois < periodeDebut) periodeDebut = mois;
        if (!periodeFin   || mois > periodeFin)   periodeFin   = mois;
      }

      batch.push({
        id:                  uuidv4(),
        idInterventionIw:    this.parseBigInt(get('idInterventionIw')),
        idInterventionGrdv:  this.parseBigInt(get('idInterventionGrdv')),
        idTechnicienCas,
        nomTechnicien,
        nomSociete,
        codeDepartement:     get('codeDepartement'),
        departement:         get('departement'),
        dateIntervention:    dateI,
        moisIntervention:    mois,
        semaineIntervention: get('semaineIntervention'),
        technologie:         get('technologie'),
        infrastructure:      get('infrastructure'),
        operateur:           get('operateur'),
        typeAbonne:          get('typeAbonne'),
        modeleModem:         get('modeleModem'),
        typezone,
        activites,
        typePresta:          get('typePresta'),
        etat,
        codeCloture:         get('codeCloture'),
        categorieEchec:      get('categorieEchec'),
        aboRacco110:         get('aboRacco110'),
        aboRacco120:         get('aboRacco120'),
        sourceImportId:      importId,
      });

      if (batch.length >= CHUNK_SIZE) {
        const cancelled = await flush();
        if (cancelled) {
          const duree = (Date.now() - t0) / 1000;
          await this.prisma.importConsommableLog.update({
            where: { id: importId },
            data: { statut: 'ANNULE', nbLignesTotal: nbTotal, nbLignesImportees: nbImportees, nbErreurs, dureeSecondes: duree, erreurs: [{ message: "Import annulé par l'utilisateur" }] as any },
          });
          this.logger.log(`Import ${filename} annulé après ${nbImportees} lignes importées`);
          return;
        }
      }
    }
    await flush();

    const duree = (Date.now() - t0) / 1000;
    const statut = nbErreurs === 0 ? 'SUCCES' : nbImportees > 0 ? 'PARTIEL' : 'ECHEC';

    await this.prisma.importConsommableLog.update({
      where: { id: importId },
      data: { statut, nbLignesTotal: nbTotal, nbLignesImportees: nbImportees, nbErreurs, dureeSecondes: duree, erreurs: errors as any, periodeDebut, periodeFin },
    });

    this.logger.log(`Import ${filename} : ${nbImportees}/${nbTotal} lignes — ${duree.toFixed(1)}s — ${statut}`);
  }

  // ── Import Référentiel Techniciens ────────────────────────────────────────────

  async importTechniciens(file: Express.Multer.File): Promise<{ nb: number; colonnesDetectees: string[] }> {
    const wb = await this.loadWb(file.buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new Error('Aucune feuille trouvée dans le fichier');

    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = String(cell.value ?? '').trim();
    });

    const colIdx = this.findCols(headers, TECH_COLS);

    if (colIdx['idCas'] === undefined) {
      throw new Error(
        `Colonne ID technicien non trouvée. Colonnes détectées dans le fichier : ${headers.filter(Boolean).join(', ')}`,
      );
    }

    const records: { idCas: bigint; nomTechnicien: string; nomSociete: string | null }[] = [];
    const rowCount = sheet.rowCount;

    for (let rowNum = 2; rowNum <= rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      const get = (f: string) => colIdx[f] !== undefined ? this.cellStr(row.getCell(colIdx[f] + 1)) : null;

      const idCas = this.parseBigInt(get('idCas'));
      const nom   = get('nomTechnicien');
      if (!idCas || !nom) continue;

      records.push({ idCas, nomTechnicien: nom, nomSociete: get('nomSociete') });
    }

    // Upsert en batch (transaction unique → 1 round-trip réseau au lieu de N)
    const nb = records.length;
    if (nb > 0) {
      await this.prisma.$transaction(
        records.map(rec =>
          this.prisma.technicienRef.upsert({
            where:  { idCas: rec.idCas },
            update: { nomTechnicien: rec.nomTechnicien, nomSociete: rec.nomSociete, updatedAt: new Date() },
            create: { id: uuidv4(), idCas: rec.idCas, nomTechnicien: rec.nomTechnicien, nomSociete: rec.nomSociete },
          }),
        ),
      );
    }

    this.logger.log(`Import techniciens : ${nb} enregistrements`);
    return { nb, colonnesDetectees: Object.keys(colIdx) };
  }

  // ── Annulation d'un import ────────────────────────────────────────────────────

  async cancelImport(importId: string) {
    const log = await this.prisma.importConsommableLog.findUnique({
      where: { id: importId }, select: { id: true, statut: true },
    });
    if (!log) throw new Error('Import introuvable');
    if (log.statut !== 'EN_COURS') throw new Error(`Impossible d'annuler : statut = ${log.statut}`);
    pendingCancels.add(importId);
    return { message: 'Annulation demandée — l\'import s\'arrêtera au prochain lot' };
  }

  // ── Statut d'un import ────────────────────────────────────────────────────────

  async getImportStatus(importId: string) {
    return this.prisma.importConsommableLog.findUnique({
      where: { id: importId },
      select: { id: true, statut: true, nbLignesTotal: true, nbLignesImportees: true, nbErreurs: true, dureeSecondes: true, erreurs: true },
    });
  }
}
