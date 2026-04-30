import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, ChevronDown, ChevronRight, Check, Archive, Trash2, LayoutGrid, List, Download } from 'lucide-react';
import { toast } from 'sonner';
import { commandesTSApi, articlesApi, entrepotsApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { CommandeTS, Article, Entrepot } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

type LigneForm = { articleId: string; qteProd: number; qteSav: number; qteMalfacon: number; repartitions: { entrepotId: string; tauxRepartition: number }[] };

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function CommandesTS() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canEdit = hasRole('ADMIN', 'LOGISTICIEN_1');
  const importRef = useRef<HTMLInputElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [vue, setVue] = useState<'liste' | 'matrice'>('liste');
  const [titre, setTitre] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [lignesForm, setLignesForm] = useState<Record<string, LigneForm>>({});
  const [entrepotRepartitions, setEntrepotRepartitions] = useState<Record<string, number>>({});

  const { data: commandesTS = [] } = useQuery<CommandeTS[]>({
    queryKey: ['commandes-ts'],
    queryFn: commandesTSApi.list,
  });
  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ['articles'],
    queryFn: () => articlesApi.list(),
  });
  const { data: entrepots = [] } = useQuery<Entrepot[]>({
    queryKey: ['entrepots'],
    queryFn: () => entrepotsApi.list(),
  });

  const createMut = useMutation({
    mutationFn: commandesTSApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commandes-ts'] }); toast.success('Commande TS créée'); closeCreate(); },
  });

  const cloturerMut = useMutation({
    mutationFn: commandesTSApi.cloturer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commandes-ts'] }); toast.success('Commande clôturée'); },
  });

  const updateLigneMut = useMutation({
    mutationFn: ({ ligneId, data }: { ligneId: string; data: any }) => commandesTSApi.updateLigne(ligneId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes-ts'] }),
  });

  const updateRepartitionMut = useMutation({
    mutationFn: ({ repartitionId, data }: { repartitionId: string; data: any }) => commandesTSApi.updateRepartition(repartitionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes-ts'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => commandesTSApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commandes-ts'] });
      toast.success('Commande TS supprimée');
      setConfirmDeleteId(null);
    },
  });

  const importMut = useMutation({
    mutationFn: commandesTSApi.import,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['commandes-ts'] });
      toast.success(`Import terminé : ${data.created} ajoutées, ${data.skipped} ignorées`);
    },
    onError: () => toast.error("Erreur lors de l'import"),
  });

  const closeCreate = () => {
    setCreateOpen(false); setTitre(''); setDateDebut(''); setDateFin(''); setCommentaire('');
    setSelectedArticles(new Set()); setLignesForm({}); setEntrepotRepartitions({});
  };

  // Ouvre le dialog et pré-coche tous les articles actifs
  const openCreate = () => {
    const actifs = articles.filter(a => a.actif);
    const allIds = new Set(actifs.map(a => a.id));
    const allForms: Record<string, LigneForm> = {};
    actifs.forEach(a => {
      allForms[a.id] = { articleId: a.id, qteProd: 0, qteSav: 0, qteMalfacon: 0, repartitions: entrepots.map(e => ({ entrepotId: e.id, tauxRepartition: 0 })) };
    });
    setSelectedArticles(allIds);
    setLignesForm(allForms);
    setCreateOpen(true);
  };

  // Export Excel de toutes les Commandes TS
  const exportExcel = () => {
    // Construction CSV propre
    const cmdsSorted = [...commandesTS].sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime());

    // Collecte tous les articles uniques
    const artMap = new Map<string, string>();
    cmdsSorted.forEach(c => c.lignes?.forEach(l => { if (l.article) artMap.set(l.articleId, l.article.nom); }));
    const artIds = [...artMap.keys()];

    // Header
    const headers = ['Article', ...cmdsSorted.flatMap(c => [`${c.titre} PROD`, `${c.titre} SAV`, `${c.titre} MALFACON`])];

    const rows = artIds.map(artId => {
      const nom = artMap.get(artId) ?? artId;
      const cells = cmdsSorted.flatMap(c => {
        const l = c.lignes?.find(l => l.articleId === artId);
        return [l?.qteProd ?? 0, l?.qteSav ?? 0, l?.qteMalfacon ?? 0];
      });
      return [nom, ...cells];
    });

    // Génère CSV
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commandes-ts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleArticle = (articleId: string) => {
    const next = new Set(selectedArticles);
    if (next.has(articleId)) {
      next.delete(articleId);
      const newForm = { ...lignesForm };
      delete newForm[articleId];
      setLignesForm(newForm);
    } else {
      next.add(articleId);
      setLignesForm(p => ({ ...p, [articleId]: { articleId, qteProd: 0, qteSav: 0, qteMalfacon: 0, repartitions: entrepots.map(e => ({ entrepotId: e.id, tauxRepartition: 0 })) } }));
    }
    setSelectedArticles(next);
  };

  const handleCreate = () => {
    if (!titre || !dateDebut || !dateFin) { toast.error('Titre et dates requis'); return; }
    if (selectedArticles.size === 0) { toast.error('Sélectionnez au moins un article'); return; }
    const lignes = Object.values(lignesForm);
    createMut.mutate({ titre, dateDebut, dateFin, commentaire, lignes });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">Commandes TS — Approvisionnement périodique</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Planification des commandes de matériel sur des périodes fixes (1 à 3 mois)</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vue */}
          <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
            <button onClick={() => setVue('liste')}
              className={cn('flex items-center gap-1 px-3 py-1.5 text-xs rounded font-medium transition-colors',
                vue === 'liste' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <List className="w-3.5 h-3.5" /> Liste
            </button>
            <button onClick={() => setVue('matrice')}
              className={cn('flex items-center gap-1 px-3 py-1.5 text-xs rounded font-medium transition-colors',
                vue === 'matrice' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <LayoutGrid className="w-3.5 h-3.5" /> Matrice
            </button>
          </div>
          {commandesTS.length > 0 && (
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border text-muted-foreground rounded-lg hover:bg-muted">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
          {canEdit && (
            <div className="flex items-center gap-2">
              <button onClick={() => commandesTSApi.template().then(b => downloadBlob(b, 'template-commandes-ts.xlsx'))} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
                Modèle Excel
              </button>
              <button onClick={() => importRef.current?.click()} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
                Importer
              </button>
              <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ''; }} />
            </div>
          )}
          {canEdit && (
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Nouvelle commande TS
            </button>
          )}
        </div>
      </div>

      {/* ── Vue Matrice article × commande TS ── */}
      {vue === 'matrice' && (() => {
        // Toutes les commandes TS triées par date de début
        const cmdsSorted = [...commandesTS].sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime());
        // Map articleId → nom+ref
        const artMap = new Map<string, { nom: string; reference: string }>();
        commandesTS.forEach(c => {
          c.lignes?.forEach(l => {
            if (l.article && !artMap.has(l.articleId)) {
              artMap.set(l.articleId, { nom: l.article.nom, reference: l.article.reference ?? '' });
            }
          });
        });
        const artsMatrice = [...artMap.entries()].sort((a, b) => a[1].nom.localeCompare(b[1].nom));

        // Lookup : articleId_commandeId → { prod, sav, malfacon }
        const lookup = new Map<string, { prod: number; sav: number; malfacon: number }>();
        commandesTS.forEach(c => {
          c.lignes?.forEach(l => {
            lookup.set(`${l.articleId}_${c.id}`, { prod: l.qteProd, sav: l.qteSav, malfacon: l.qteMalfacon });
          });
        });

        return (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {artsMatrice.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Aucune donnée disponible. Créez d'abord une commande TS avec des articles.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 bg-muted/30 min-w-[200px]">Article</th>
                      {cmdsSorted.map(c => (
                        <th key={c.id} className="text-center px-2 py-2.5 font-semibold text-muted-foreground min-w-[130px]">
                          <div className="text-primary font-bold truncate max-w-[130px]" title={c.titre}>{c.titre}</div>
                          <div className="text-muted-foreground/70 font-normal text-xs">
                            {formatDate(c.dateDebut)} → {formatDate(c.dateFin)}
                          </div>
                          <div className={cn('text-xs font-medium mt-0.5', c.statut === 'CLOTUREE' ? 'text-gray-500' : 'text-green-600')}>
                            {c.statut === 'CLOTUREE' ? 'Clôturée' : 'En cours'}
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-border/30 bg-muted/10">
                      <th className="sticky left-0 bg-muted/10" />
                      {cmdsSorted.map(c => (
                        <th key={c.id} className="text-center px-2 py-1 text-muted-foreground/70 font-normal">
                          <span className="text-green-700">PROD</span> / <span className="text-orange-600">SAV</span> / <span className="text-red-600">MAL</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {artsMatrice.map(([artId, art]) => (
                      <tr key={artId} className="border-t border-border/30 hover:bg-muted/10">
                        <td className="px-3 py-2 sticky left-0 bg-card border-r border-border/30">
                          <p className="font-medium">{art.nom}</p>
                          <p className="font-mono text-muted-foreground">{art.reference}</p>
                        </td>
                        {cmdsSorted.map(c => {
                          const cell = lookup.get(`${artId}_${c.id}`);
                          return (
                            <td key={c.id} className="px-2 py-2 text-center">
                              {cell ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-green-700">{cell.prod > 0 ? cell.prod : '—'}</div>
                                  <div className="text-orange-600">{cell.sav > 0 ? cell.sav : '—'}</div>
                                  <div className="text-red-600">{cell.malfacon > 0 ? cell.malfacon : '—'}</div>
                                </div>
                              ) : <span className="text-muted-foreground/30">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Vue Liste ── */}
      {vue === 'liste' && <div className="space-y-2">
        {commandesTS.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Archive className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Aucune commande TS. Créez votre première commande d'approvisionnement périodique.</p>
          </div>
        ) : commandesTS.map(c => {
          const isExpanded = expandedId === c.id;
          const totalArticles = c.lignes?.length ?? 0;
          const totalQte = c.lignes?.reduce((s, l) => s + l.qteProd + l.qteSav + l.qteMalfacon, 0) ?? 0;
          const totalRecu = c.lignes?.reduce((s, l) => s + (l.repartitions?.reduce((r, rp) => r + rp.qteRecue, 0) ?? 0), 0) ?? 0;
          const tauxCouverture = totalQte > 0 ? Math.round((totalRecu / totalQte) * 100) : 0;

          return (
            <div key={c.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Header ligne */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{c.numero}</span>
                    <span className="font-semibold text-sm">{c.titre}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', c.statut === 'CLOTUREE' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700')}>
                      {c.statut === 'CLOTUREE' ? 'Clôturée' : 'En cours'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(c.dateDebut)} → {formatDate(c.dateFin)} · {totalArticles} articles · {totalQte} unités commandées
                  </p>
                </div>
                {/* Mini KPIs */}
                <div className="flex items-center gap-4 text-xs flex-shrink-0">
                  <div className="text-center">
                    <p className="text-muted-foreground">Reçu</p>
                    <p className="font-semibold text-green-600">{totalRecu}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Couverture</p>
                    <p className={cn('font-semibold', tauxCouverture >= 80 ? 'text-green-600' : tauxCouverture >= 50 ? 'text-amber-600' : 'text-red-600')}>
                      {tauxCouverture}%
                    </p>
                  </div>
                  {canEdit && c.statut === 'EN_COURS' && (
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm('Clôturer cette commande TS ?')) cloturerMut.mutate(c.id); }}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Archive className="w-3 h-3" /> Clôturer
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                </div>
              </div>

              {/* Détail expandé */}
              {isExpanded && c.lignes && c.lignes.length > 0 && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Article</th>
                        <th className="text-right px-3 py-2 font-semibold text-blue-600 uppercase tracking-wide">PROD</th>
                        <th className="text-right px-3 py-2 font-semibold text-orange-600 uppercase tracking-wide">SAV</th>
                        <th className="text-right px-3 py-2 font-semibold text-red-600 uppercase tracking-wide">Malfaçon</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                        {entrepots.map(e => (
                          <th key={e.id} className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{e.code} reçu</th>
                        ))}
                        <th className="text-right px-3 py-2 font-semibold text-green-600 uppercase tracking-wide">Total reçu</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.lignes.map(ligne => {
                        const total = ligne.qteProd + ligne.qteSav + ligne.qteMalfacon;
                        const recuTotal = ligne.repartitions?.reduce((s, r) => s + r.qteRecue, 0) ?? 0;
                        const taux = total > 0 ? Math.round((recuTotal / total) * 100) : 0;
                        return (
                          <tr key={ligne.id} className="border-t border-border/40 hover:bg-muted/10">
                            <td className="px-3 py-2">
                              <p className="font-medium">{ligne.article?.nom}</p>
                              <p className="text-muted-foreground font-mono">{ligne.article?.reference}</p>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {canEdit && c.statut === 'EN_COURS' ? (
                                <input type="number" min={0} defaultValue={ligne.qteProd}
                                  onBlur={e => { const v = parseInt(e.target.value) || 0; if (v !== ligne.qteProd) updateLigneMut.mutate({ ligneId: ligne.id, data: { qteProd: v, qteSav: ligne.qteSav, qteMalfacon: ligne.qteMalfacon } }); }}
                                  className="w-16 text-right px-1 py-0.5 border border-border rounded text-xs" />
                              ) : <span className="text-blue-600 font-medium">{ligne.qteProd}</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {canEdit && c.statut === 'EN_COURS' ? (
                                <input type="number" min={0} defaultValue={ligne.qteSav}
                                  onBlur={e => { const v = parseInt(e.target.value) || 0; if (v !== ligne.qteSav) updateLigneMut.mutate({ ligneId: ligne.id, data: { qteProd: ligne.qteProd, qteSav: v, qteMalfacon: ligne.qteMalfacon } }); }}
                                  className="w-16 text-right px-1 py-0.5 border border-border rounded text-xs" />
                              ) : <span className="text-orange-600 font-medium">{ligne.qteSav}</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {canEdit && c.statut === 'EN_COURS' ? (
                                <input type="number" min={0} defaultValue={ligne.qteMalfacon}
                                  onBlur={e => { const v = parseInt(e.target.value) || 0; if (v !== ligne.qteMalfacon) updateLigneMut.mutate({ ligneId: ligne.id, data: { qteProd: ligne.qteProd, qteSav: ligne.qteSav, qteMalfacon: v } }); }}
                                  className="w-16 text-right px-1 py-0.5 border border-border rounded text-xs" />
                              ) : <span className="text-red-600 font-medium">{ligne.qteMalfacon}</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-bold">{total}</td>
                            {entrepots.map(e => {
                              const rep = ligne.repartitions?.find(r => r.entrepotId === e.id);
                              return (
                                <td key={e.id} className="px-3 py-2 text-right">
                                  <span className="text-green-700 font-medium">{rep?.qteRecue ?? 0}</span>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-right font-bold text-green-600">{recuTotal}</td>
                            <td className={cn('px-3 py-2 text-right font-semibold', taux >= 80 ? 'text-green-600' : taux >= 50 ? 'text-amber-600' : 'text-red-600')}>
                              {taux}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {/* Dialog confirmation suppression */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Supprimer la commande TS ?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {commandesTS.find(c => c.id === confirmDeleteId)?.numero} — Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                Annuler
              </button>
              <button onClick={() => deleteMut.mutate(confirmDeleteId)} disabled={deleteMut.isPending}
                className="px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleteMut.isPending ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog création */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold">Nouvelle commande TS</h2>
              <button onClick={closeCreate} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Titre *</label>
                  <input value={titre} onChange={e => setTitre(e.target.value)}
                    placeholder="Commande Q1 2025…"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date début *</label>
                  <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date fin *</label>
                  <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Commentaire</label>
                <input value={commentaire} onChange={e => setCommentaire(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>

              {/* Sélection articles avec quantités */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Articles à commander ({selectedArticles.size} sélectionné(s))
                </p>
                <div className="border border-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/50">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Article</th>
                        <th className="text-right px-3 py-2 font-semibold text-blue-600">PROD</th>
                        <th className="text-right px-3 py-2 font-semibold text-orange-600">SAV</th>
                        <th className="text-right px-3 py-2 font-semibold text-red-600">Malfaçon</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {articles.map(a => {
                        const checked = selectedArticles.has(a.id);
                        const form = lignesForm[a.id];
                        const total = form ? form.qteProd + form.qteSav + form.qteMalfacon : 0;
                        return (
                          <tr key={a.id} className={cn('border-t border-border/40 hover:bg-muted/10 transition-colors', checked && 'bg-primary/5')}>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={checked} onChange={() => toggleArticle(a.id)}
                                className="w-3.5 h-3.5 accent-primary cursor-pointer" />
                            </td>
                            <td className="px-3 py-2">
                              <p className="font-medium">{a.nom}</p>
                              <p className="text-muted-foreground font-mono">{a.reference}</p>
                            </td>
                            {checked && form ? (
                              <>
                                <td className="px-3 py-2 text-right">
                                  <input type="number" min={0} value={form.qteProd}
                                    onChange={e => setLignesForm(p => ({ ...p, [a.id]: { ...p[a.id], qteProd: parseInt(e.target.value) || 0 } }))}
                                    className="w-16 text-right px-1 py-0.5 border border-border rounded text-xs" />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <input type="number" min={0} value={form.qteSav}
                                    onChange={e => setLignesForm(p => ({ ...p, [a.id]: { ...p[a.id], qteSav: parseInt(e.target.value) || 0 } }))}
                                    className="w-16 text-right px-1 py-0.5 border border-border rounded text-xs" />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <input type="number" min={0} value={form.qteMalfacon}
                                    onChange={e => setLignesForm(p => ({ ...p, [a.id]: { ...p[a.id], qteMalfacon: parseInt(e.target.value) || 0 } }))}
                                    className="w-16 text-right px-1 py-0.5 border border-border rounded text-xs" />
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-foreground">{total}</td>
                              </>
                            ) : (
                              <td colSpan={4} className="px-3 py-2 text-center text-muted-foreground/40 italic text-xs">Cocher pour saisir les quantités</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeCreate} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleCreate} disabled={createMut.isPending}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Créer la commande TS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
