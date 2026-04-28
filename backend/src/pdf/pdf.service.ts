import { Injectable } from '@nestjs/common';

@Injectable()
export class PdfService {
  async genererFichePerception(commande: any): Promise<Buffer> {
    const PDFDocument = require('pdfkit');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', (c: Buffer) => buffers.push(c));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const W = 515; // largeur utile
      const bleu = '#1a3a6b';
      const orange = '#e8600a';
      const gris = '#f4f6fa';
      const grisBord = '#d1d5db';
      const noir = '#1f2937';
      const grisTexte = '#6b7280';

      // ── EN-TÊTE ─────────────────────────────────────────────────────────────
      doc.rect(40, 40, W, 52).fill(bleu);
      doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold')
        .text('FICHE DE PERCEPTION', 55, 52, { width: W - 20, align: 'left' });
      doc.fontSize(9).fillColor('#aac4ee').font('Helvetica')
        .text('Logistique Fibre Optique D3', 55, 74);

      // N° commande à droite
      doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold')
        .text(commande.numero, 40, 58, { width: W - 10, align: 'right' });
      doc.fontSize(8).fillColor('#aac4ee').font('Helvetica')
        .text(`Émis le ${new Date().toLocaleDateString('fr-FR')}`, 40, 74, { width: W - 10, align: 'right' });

      let y = 108;

      // ── BLOC INFOS COMMANDE ──────────────────────────────────────────────────
      doc.rect(40, y, W, 14).fill(bleu);
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
        .text('INFORMATIONS DE LA COMMANDE', 48, y + 3);
      y += 14;

      doc.rect(40, y, W, 60).fill(gris).stroke(grisBord);

      const cols = [
        { label: 'Date réception', value: new Date(commande.dateReception).toLocaleDateString('fr-FR') },
        { label: 'Date traitement', value: commande.dateTraitement ? new Date(commande.dateTraitement).toLocaleDateString('fr-FR') : '—' },
        { label: 'Département', value: commande.departement || '—' },
        { label: 'Grilles', value: commande.nombreGrilles ? String(commande.nombreGrilles) : '—' },
      ];
      const colW = W / cols.length;
      cols.forEach((col, i) => {
        const cx = 40 + i * colW + 8;
        doc.fontSize(7).fillColor(grisTexte).font('Helvetica').text(col.label.toUpperCase(), cx, y + 8, { width: colW - 12 });
        doc.fontSize(10).fillColor(noir).font('Helvetica-Bold').text(col.value, cx, y + 20, { width: colW - 12 });
      });

      const cols2 = [
        { label: 'Demandeur', value: commande.demandeur || '—' },
        { label: 'Société', value: commande.societe || '—' },
        { label: 'Email', value: commande.emailDemandeur || '—' },
        { label: 'Manager', value: commande.manager || '—' },
      ];
      cols2.forEach((col, i) => {
        const cx = 40 + i * colW + 8;
        doc.fontSize(7).fillColor(grisTexte).font('Helvetica').text(col.label.toUpperCase(), cx, y + 38, { width: colW - 12 });
        doc.fontSize(9).fillColor(noir).font('Helvetica').text(col.value, cx, y + 48, { width: colW - 12, ellipsis: true });
      });

      y += 70;

      // ── TABLEAU ARTICLES ─────────────────────────────────────────────────────
      doc.rect(40, y, W, 14).fill(bleu);
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
        .text('ARTICLES COMMANDÉS', 48, y + 3);
      y += 14;

      // En-têtes colonnes
      const tCols = [
        { label: 'RÉFÉRENCE', x: 40, w: 100 },
        { label: 'DÉSIGNATION', x: 140, w: 185 },
        { label: 'UNITÉ', x: 325, w: 50 },
        { label: 'QTÉ DEM.', x: 375, w: 65 },
        { label: 'QTÉ VAL.', x: 440, w: 65 },
        { label: 'OBS.', x: 505, w: 50 },
      ];

      doc.rect(40, y, W, 16).fill('#e8eef8');
      tCols.forEach(col => {
        doc.fontSize(7).fillColor(bleu).font('Helvetica-Bold')
          .text(col.label, col.x + 3, y + 5, { width: col.w - 4 });
      });
      y += 16;

      const lignes = commande.lignes || [];
      lignes.forEach((ligne: any, i: number) => {
        const rowH = 18;
        if (y + rowH > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }

        doc.rect(40, y, W, rowH).fill(i % 2 === 0 ? '#ffffff' : gris)
          .strokeColor(grisBord).rect(40, y, W, rowH).stroke();

        // Séparateurs verticaux
        tCols.forEach(col => {
          doc.moveTo(col.x, y).lineTo(col.x, y + rowH).strokeColor(grisBord).stroke();
        });
        doc.moveTo(555, y).lineTo(555, y + rowH).strokeColor(grisBord).stroke();

        doc.fontSize(8).fillColor(noir).font('Helvetica-Oblique')
          .text(ligne.article?.reference || '—', tCols[0].x + 3, y + 5, { width: tCols[0].w - 4, ellipsis: true });
        doc.font('Helvetica')
          .text(ligne.article?.nom || '—', tCols[1].x + 3, y + 5, { width: tCols[1].w - 4, ellipsis: true });
        doc.text(ligne.article?.unite || 'u', tCols[2].x + 3, y + 5, { width: tCols[2].w - 4 });

        const qteVal = String(ligne.quantiteDemandee);
        const valVal = ligne.quantiteValidee != null ? String(ligne.quantiteValidee) : '—';
        const diff = ligne.quantiteValidee != null && ligne.quantiteValidee < ligne.quantiteDemandee;

        doc.text(qteVal, tCols[3].x + 3, y + 5, { width: tCols[3].w - 4 });
        doc.fillColor(diff ? orange : noir).text(valVal, tCols[4].x + 3, y + 5, { width: tCols[4].w - 4 });
        doc.fillColor(noir).text('', tCols[5].x + 3, y + 5, { width: tCols[5].w - 4 });

        y += rowH;
      });

      // Bordure bas tableau
      doc.rect(40, y, W, 1).fill(bleu);
      y += 10;

      // Commentaire
      if (commande.commentaire) {
        doc.rect(40, y, W, 30).fill(gris).strokeColor(grisBord).stroke();
        doc.fontSize(7).fillColor(grisTexte).text('COMMENTAIRE', 48, y + 5);
        doc.fontSize(9).fillColor(noir).text(commande.commentaire, 48, y + 15, { width: W - 16, ellipsis: true });
        y += 40;
      }

      // ── ENGAGEMENT DU TECHNICIEN ──────────────────────────────────────────────
      if (y + 130 > doc.page.height - 200) { doc.addPage(); y = 50; }

      doc.rect(40, y, W, 14).fill('#1e3a5f');
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
        .text('ENGAGEMENT DU TECHNICIEN / SOUS-TRAITANT', 48, y + 3);
      y += 14;

      const engagements = [
        "Je m'engage à utiliser le matériel fourni exclusivement dans le cadre de l'intervention confiée par la société D3.",
        "Je m'engage à retourner tout matériel non utilisé en bon état, dans les délais impartis.",
        "En cas de perte, de vol ou de dégradation du matériel, je reconnais être tenu(e) personnellement responsable.",
        "La signature de ce bon de perception vaut accusé de réception et acceptation des présentes conditions.",
      ];

      doc.rect(40, y, W, 72).fill('#f8fafc').strokeColor(grisBord).stroke();
      engagements.forEach((txt, i) => {
        const ty = y + 6 + i * 16;
        doc.fontSize(8).fillColor('#1e3a5f').font('Helvetica-Bold').text('•', 50, ty);
        doc.fillColor(noir).font('Helvetica').text(txt, 62, ty, { width: W - 30 });
      });
      y += 78;

      // ── CLAUSE DE RETENUE FINANCIÈRE ─────────────────────────────────────────
      doc.rect(40, y, W, 14).fill('#7f1d1d');
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
        .text('CLAUSE DE RETENUE FINANCIÈRE', 48, y + 3);
      y += 14;

      const rouge = '#991b1b';
      doc.rect(40, y, W, 32).fill('#fff5f5').strokeColor('#fca5a5').stroke();
      doc.fontSize(8).fillColor(rouge).font('Helvetica-Oblique')
        .text(
          'En cas de non-retour ou de perte avérée du matériel, une retenue financière équivalente à la valeur du matériel manquant sera automatiquement appliquée sur le prochain règlement de facturation, sans préjudice de toute autre voie de recours.',
          50, y + 7, { width: W - 20 }
        );
      y += 38;

      // ── SIGNATURES ───────────────────────────────────────────────────────────
      if (y + 120 > doc.page.height - 50) { doc.addPage(); y = 50; }

      doc.rect(40, y, W, 14).fill(bleu);
      doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold').text('SIGNATURES', 48, y + 3);
      y += 14;

      // "Je reconnais avoir reçu..." text
      doc.rect(40, y, W, 22).fill('#f0f7ff').strokeColor('#bfdbfe').stroke();
      doc.fontSize(8).fillColor('#1e40af').font('Helvetica-Oblique')
        .text(
          'Je reconnais avoir reçu le matériel mentionné ci-dessus en bon état et m\'engage à respecter les conditions d\'utilisation susvisées.',
          50, y + 7, { width: W - 20 }
        );
      y += 22;

      // Deux blocs de signature : Distributeur + Destinataire
      doc.rect(40, y, W, 72).fill(gris).strokeColor(grisBord).stroke();
      const sigW = W / 2;
      const sigPairs = [
        { label: 'Distributeur (Logistique D3)', sub: 'Nom, prénom et signature' },
        { label: 'Destinataire (Technicien / Sous-traitant)', sub: 'Nom, prénom et signature' },
      ];
      sigPairs.forEach((sig, i) => {
        const sx = 40 + i * sigW;
        if (i > 0) doc.moveTo(sx, y).lineTo(sx, y + 72).strokeColor(grisBord).stroke();
        doc.fontSize(8).fillColor(grisTexte).font('Helvetica').text(sig.label, sx + 6, y + 7, { width: sigW - 12 });
        doc.fontSize(7).fillColor('#9ca3af').text(sig.sub, sx + 6, y + 18, { width: sigW - 12 });
        doc.moveTo(sx + 10, y + 58).lineTo(sx + sigW - 10, y + 58).strokeColor('#9ca3af').stroke();
        // Date line
        doc.fontSize(7).fillColor(grisTexte).text('Date : ___________', sx + 6, y + 62, { width: sigW - 12 });
      });
      y += 80;

      // ── PIED DE PAGE ──────────────────────────────────────────────────────────
      doc.rect(40, doc.page.height - 38, W, 18).fill(bleu);
      doc.fontSize(7).fillColor('#aac4ee').font('Helvetica')
        .text(
          `Logistique D3 — Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} — ${commande.numero}`,
          40, doc.page.height - 32, { width: W, align: 'center' },
        );

      doc.end();
    });
  }
}
