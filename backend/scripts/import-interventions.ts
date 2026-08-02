/**
 * Script local — Import interventions terrain depuis un gros fichier Excel
 * Utilise la même logique que le backend mais sans passer par Vercel.
 *
 * Usage :
 *   cd backend
 *   npx ts-node scripts/import-interventions.ts "C:\chemin\vers\fichier.xlsx"
 *   npx ts-node scripts/import-interventions.ts "C:\chemin\vers\fichier.xlsx" --force
 *
 * Le script lit DATABASE_URL depuis backend/.env (ou la variable d'environnement).
 * Pour la production, passe DATABASE_URL en variable d'env :
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/import-interventions.ts fichier.xlsx
 */

import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

// ── Même mapping que le backend ──────────────────────────────────────────────

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
  estEchu:             ['Est échue ?', 'Est echu ?', 'Est échue', 'Est echou', 'Echue'],
  estAnnule:           ['Est annulée ?', 'Est annule ?', 'Est annulée', 'Annulee'],
};

const NULL_STRINGS = new Set([
  '', 'null', 'undefined', 'nan', 'NaN', 'None', 'none',
  '#REF!', '#N/A', '#VALEUR!', '#VALUE!', '#NOM?', '#NAME?',
]);

const CHUNK_SIZE = 500;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellStr(cell: ExcelJS.Cell): string | null {
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

function parseBigInt(s: string | null): bigint | null {
  if (!s) return null;
  const n = Number(s.replace(/[^\d-]/g, ''));
  return isNaN(n) ? null : BigInt(Math.round(n));
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  if (s.includes('T')) return new Date(s);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseMois(s: string | null): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}$/.test(s)) {
    const d = new Date(s + '-01T00:00:00Z');
    return isNaN(d.getTime()) ? null : d;
  }
  return parseDate(s);
}

function parseBoolean(s: string | null): boolean | null {
  if (!s) return null;
  const l = s.toLowerCase().trim();
  if (['1', 'true', 'vrai', 'oui', 'yes'].includes(l)) return true;
  if (['0', 'false', 'faux', 'non', 'no'].includes(l)) return false;
  return null;
}

function findCols(headers: string[], map: Record<string, string[]>): Record<string, number> {
  const idx: Record<string, number> = {};
  for (const [field, candidates] of Object.entries(map)) {
    for (const c of candidates) {
      const i = headers.findIndex(h => h.toLowerCase().trim() === c.toLowerCase().trim());
      if (i !== -1) { idx[field] = i; break; }
    }
  }
  return idx;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('--'));
  const force = args.includes('--force');

  if (!filePath) {
    console.error('Usage : npx ts-node scripts/import-interventions.ts "fichier.xlsx" [--force]');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`Fichier introuvable : ${absPath}`);
    process.exit(1);
  }

  const fileSizeMB = fs.statSync(absPath).size / 1024 / 1024;
  const fileName = path.basename(absPath);
  console.log(`\n📂 Fichier : ${fileName} (${fileSizeMB.toFixed(1)} MB)`);

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('✅ Connexion base de données OK');

    // Vérification doublon
    if (!force) {
      const dup = await prisma.importConsommableLog.findFirst({
        where: { nomFichier: fileName, statut: 'SUCCES' },
        select: { id: true, dateImport: true },
      });
      if (dup) {
        console.error(`\n⚠️  "${fileName}" a déjà été importé avec succès (${dup.dateImport.toLocaleDateString('fr-FR')}).`);
        console.error('   Ajoutez --force pour forcer le ré-import.');
        process.exit(1);
      }
    }

    // Créer l'entrée de log
    const importId = uuidv4();
    await prisma.importConsommableLog.create({
      data: { id: importId, nomFichier: fileName, statut: 'EN_COURS' },
    });

    // Charger le référentiel techniciens
    console.log('🔍 Chargement du référentiel techniciens…');
    const techRefs = await prisma.technicienRef.findMany({
      select: { idCas: true, nomTechnicien: true, nomSociete: true },
    });
    const techMap = new Map<bigint, { nom: string; soc: string | null }>();
    for (const r of techRefs) techMap.set(r.idCas, { nom: r.nomTechnicien, soc: r.nomSociete });
    console.log(`   → ${techMap.size} techniciens chargés`);

    // Charger le fichier Excel
    console.log('📖 Lecture du fichier Excel…');
    const t0 = Date.now();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fs.readFileSync(absPath) as any);

    const sheet = wb.getWorksheet('INTERVENTIONS TECHNO SMART')
               ?? wb.getWorksheet('INTERVENTION TECHNO SMART')
               ?? wb.worksheets[0];
    if (!sheet) throw new Error('Aucune feuille trouvée dans le fichier');
    console.log(`   → Feuille : "${sheet.name}" (${sheet.rowCount} lignes brutes)`);

    // En-têtes
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = String(cell.value ?? '').trim();
    });
    const colIdx = findCols(headers, INTERVENTION_COLS);
    const detectedCols = Object.keys(colIdx).join(', ');
    console.log(`   → Colonnes détectées : ${detectedCols}`);

    // Traitement
    let nbTotal = 0, nbImportees = 0, nbErreurs = 0, nbFiltrees = 0;
    let periodeDebut: Date | null = null, periodeFin: Date | null = null;
    const errors: { ligne: number; message: string }[] = [];
    let batch: any[] = [];

    const flush = async () => {
      if (!batch.length) return;
      try {
        await prisma.interventionTerrain.createMany({ data: batch });
        nbImportees += batch.length;
      } catch (err: any) {
        nbErreurs += batch.length;
        if (errors.length < 50) errors.push({ ligne: nbTotal, message: String(err?.message ?? err).slice(0, 200) });
      }
      batch = [];
    };

    const totalRows = sheet.rowCount;
    const printEvery = Math.max(1000, Math.floor(totalRows / 20));

    for (let rowNum = 2; rowNum <= totalRows; rowNum++) {
      const row = sheet.getRow(rowNum);
      nbTotal++;

      if (nbTotal % printEvery === 0) {
        const pct = Math.round((rowNum / totalRows) * 100);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        process.stdout.write(`\r   → ${pct}% (${nbTotal.toLocaleString('fr-FR')} lignes lues, ${nbImportees.toLocaleString('fr-FR')} importées, ${elapsed}s)`);
      }

      const get = (f: string) => colIdx[f] !== undefined ? cellStr(row.getCell(colIdx[f] + 1)) : null;

      const estEchu   = parseBoolean(get('estEchu'));
      const estAnnule = parseBoolean(get('estAnnule'));
      if (estEchu !== true) { nbFiltrees++; continue; }
      if (estAnnule === true) { nbFiltrees++; continue; }

      const typezone  = get('typezone');
      const activites = get('activites');
      const etat      = get('etat');
      const idTechStr = get('idTechnicienCas');
      if (!typezone && !activites && !etat && !idTechStr && !get('operateur')) { nbFiltrees++; continue; }

      const idTechnicienCas = parseBigInt(idTechStr);
      const techRef = idTechnicienCas ? techMap.get(idTechnicienCas) : null;

      const mois  = parseMois(get('moisIntervention'));
      const dateI = parseDate(get('dateIntervention'));

      if (mois) {
        if (!periodeDebut || mois < periodeDebut) periodeDebut = mois;
        if (!periodeFin   || mois > periodeFin)   periodeFin   = mois;
      }

      batch.push({
        id:                  uuidv4(),
        idInterventionIw:    parseBigInt(get('idInterventionIw')),
        idInterventionGrdv:  parseBigInt(get('idInterventionGrdv')),
        idTechnicienCas,
        nomTechnicien:       get('nomTechnicien') ?? techRef?.nom ?? null,
        nomSociete:          get('nomSociete')    ?? techRef?.soc ?? null,
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

      if (batch.length >= CHUNK_SIZE) await flush();
    }
    await flush();

    const duree = (Date.now() - t0) / 1000;
    const statut = nbErreurs === 0 ? 'SUCCES' : nbImportees > 0 ? 'PARTIEL' : 'ECHEC';

    await prisma.importConsommableLog.update({
      where: { id: importId },
      data: { statut, nbLignesTotal: nbTotal, nbLignesImportees: nbImportees, nbErreurs, dureeSecondes: duree, erreurs: errors as any, periodeDebut, periodeFin },
    });

    console.log(`\n\n✅ Import terminé — ${statut}`);
    console.log(`   Lignes lues      : ${nbTotal.toLocaleString('fr-FR')}`);
    console.log(`   Lignes filtrées  : ${nbFiltrees.toLocaleString('fr-FR')} (estEchu≠1 ou estAnnule=1)`);
    console.log(`   Lignes importées : ${nbImportees.toLocaleString('fr-FR')}`);
    console.log(`   Erreurs          : ${nbErreurs}`);
    console.log(`   Durée            : ${duree.toFixed(1)}s`);
    if (periodeDebut && periodeFin) {
      console.log(`   Période          : ${periodeDebut.toLocaleDateString('fr-FR')} → ${periodeFin.toLocaleDateString('fr-FR')}`);
    }
    if (errors.length > 0) {
      console.log('\n⚠️  Premières erreurs :');
      errors.slice(0, 5).forEach(e => console.log(`   Ligne ${e.ligne}: ${e.message}`));
    }
  } catch (err: any) {
    console.error('\n❌ Erreur fatale :', err?.message ?? err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
