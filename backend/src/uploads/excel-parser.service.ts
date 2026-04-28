import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ExcelParserService {
  async parseCommandeExcel(filePath: string) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.readFile(filePath);
    } catch {
      throw new BadRequestException('Fichier Excel invalide ou corrompu');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Aucune feuille trouvée');

    // ── Extraction des infos d'en-tête (zone B1:E18 typique) ────────────────
    const meta: any = {};

    sheet.eachRow((row: any, rowIndex: number) => {
      if (rowIndex > 20) return;
      row.eachCell((cell: any, colIndex: number) => {
        const val = String(cell.value || '').trim().toLowerCase();
        const nextCell = row.getCell(colIndex + 1);
        const nextVal = nextCell ? String(nextCell.value || '').trim() : '';

        if (val.includes('responsable') || val.includes('interlocuteur')) meta.interlocuteur = nextVal;
        if (val.includes('département') || val.includes('departement')) meta.departement = nextVal;
        if (val.includes('adresse mail') || val.includes('email')) meta.emailDemandeur = nextVal;
        if (val.includes('société') || val.includes('societe')) meta.societe = nextVal;
        if (val.includes('nom et prénom') || val.includes('technicien')) meta.demandeur = nextVal;
        if (val.includes('grille utilisée') || val.includes('grille utilisee')) meta.nombreGrilles = parseInt(nextVal) || undefined;
        if (val.includes('type de grille')) meta.typeGrille = nextVal;
        if (val.includes('date de la commande') || val.includes('date commande')) {
          meta.dateCommande = nextVal;
        }
      });
    });

    // ── Détection automatique de la ligne d'en-tête du tableau ──────────────
    let headerRow = -1;
    let colRef = -1;
    let colDesignation = -1;
    let colQte = -1;

    sheet.eachRow((row: any, rowIndex: number) => {
      if (headerRow !== -1) return;
      let hasRef = false; let hasDesig = false; let hasQte = false;
      row.eachCell((cell: any, colIndex: number) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (val.includes('référence') || val.includes('reference') || val === 'ref') { colRef = colIndex; hasRef = true; }
        if (val.includes('désignation') || val.includes('designation') || val.includes('libellé')) { colDesignation = colIndex; hasDesig = true; }
        if (val.includes('commandée') || val.includes('commandee') || val.includes('quantité') || val === 'qté' || val === 'qty') { colQte = colIndex; hasQte = true; }
      });
      if (hasRef || (hasDesig && hasQte)) headerRow = rowIndex;
    });

    // ── Lecture des lignes du tableau ────────────────────────────────────────
    const lignes: any[] = [];

    if (headerRow !== -1) {
      sheet.eachRow((row: any, rowIndex: number) => {
        if (rowIndex <= headerRow) return;

        const refVal = colRef > 0 ? String(row.getCell(colRef).value || '').trim() : '';
        const desigVal = colDesignation > 0 ? String(row.getCell(colDesignation).value || '').trim() : '';
        const qteVal = colQte > 0 ? row.getCell(colQte).value : null;
        const qte = qteVal ? parseInt(String(qteVal)) || 0 : 0;

        // Ignorer les lignes vides ou sans quantité
        if ((!refVal && !desigVal) || qte === 0) return;
        // Ignorer les lignes de total / stock
        if (desigVal.toLowerCase().includes('total') || desigVal.toLowerCase().includes('stock')) return;

        lignes.push({
          reference: refVal,
          articleNom: desigVal,
          quantiteDemandee: qte,
        });
      });
    }

    return {
      departement: meta.departement || '',
      demandeur: meta.demandeur || '',
      emailDemandeur: meta.emailDemandeur || '',
      societe: meta.societe || '',
      interlocuteur: meta.interlocuteur || '',
      manager: meta.interlocuteur || '',
      nombreGrilles: meta.nombreGrilles,
      typeGrille: meta.typeGrille || '',
      dateCommande: meta.dateCommande || '',
      lignes,
      totalLignes: lignes.length,
    };
  }
}
