import { useMemo, useState } from 'react';

/**
 * Tri client d'un tableau par colonne : clic sur un en-tête → tri descendant,
 * re-clic → inverse le sens. Les valeurs nulles vont toujours en fin de liste,
 * quel que soit le sens (une ligne sans donnée ne doit jamais masquer les vraies
 * valeurs en tête de tri). Chaînes comparées en français, nombres numériquement.
 */
export function useTri<T extends Record<string, any>>(
  lignes: T[],
  cleInitiale: string | null = null,
  sensInitial: 'asc' | 'desc' = 'desc',
) {
  const [cle, setCle] = useState<string | null>(cleInitiale);
  const [sens, setSens] = useState<'asc' | 'desc'>(sensInitial);

  const trier = (nouvelle: string) => {
    if (cle === nouvelle) setSens(s => (s === 'asc' ? 'desc' : 'asc'));
    else { setCle(nouvelle); setSens('desc'); }
  };

  const triees = useMemo(() => {
    if (!cle) return lignes;
    const copie = [...lignes];
    copie.sort((a, b) => {
      const va = a[cle];
      const vb = b[cle];
      if (va == null && vb == null) return 0;
      if (va == null || va === '') return 1;
      if (vb == null || vb === '') return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'fr', { numeric: true, sensitivity: 'base' });
      return sens === 'asc' ? cmp : -cmp;
    });
    return copie;
  }, [lignes, cle, sens]);

  /** Flèche à afficher dans l'en-tête de la colonne `c` (chaîne vide si non triée). */
  const indicateur = (c: string) => (cle === c ? (sens === 'asc' ? ' ▲' : ' ▼') : '');

  return { triees, cle, sens, trier, indicateur };
}
