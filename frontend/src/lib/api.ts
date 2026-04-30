import axios from 'axios';
import { toast } from 'sonner';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.message;
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (err.response?.status === 403) {
      toast.error('Accès non autorisé pour votre rôle');
    } else if (msg) {
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
    return Promise.reject(err);
  },
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  kpis: (params?: Record<string, string>) =>
    api.get('/dashboard/kpis', { params }).then(r => r.data),
  evolution: (params?: Record<string, string>) =>
    api.get('/dashboard/evolution', { params }).then(r => r.data),
  departements: (params?: Record<string, string>) =>
    api.get('/dashboard/departements', { params }).then(r => r.data),
  demandeurs: (params?: Record<string, string>) =>
    api.get('/dashboard/demandeurs', { params }).then(r => r.data),
  delais: () => api.get('/dashboard/delais').then(r => r.data),
  topArticles: (limit = 5) =>
    api.get('/dashboard/top-articles', { params: { limit } }).then(r => r.data),
  commandes: () => api.get('/dashboard/commandes').then(r => r.data),
};

// ── Articles ──────────────────────────────────────────────────────────────────
export const articlesApi = {
  list: (params?: Record<string, string>) =>
    api.get('/articles', { params }).then(r => r.data),
  listAll: () =>
    api.get('/articles', { params: { includeInactif: 'true' } }).then(r => r.data),
  toggleActif: (id: string, actif: boolean) =>
    api.put(`/articles/${id}`, { actif }).then(r => r.data),
  stats: (params?: Record<string, string>) =>
    api.get('/articles/stats', { params }).then(r => r.data),
  get: (id: string) => api.get(`/articles/${id}`).then(r => r.data),
  create: (data: any) => api.post('/articles', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/articles/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/articles/${id}`).then(r => r.data),
  template: () => api.get('/articles/template', { responseType: 'blob' }).then(r => r.data as Blob),
  import: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/articles/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data); },
};

// ── Entrepôts ─────────────────────────────────────────────────────────────────
export const entrepotsApi = {
  list: (all?: boolean) => api.get('/entrepots', { params: all ? { all: 'true' } : {} }).then(r => r.data),
  create: (data: any) => api.post('/entrepots', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/entrepots/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/entrepots/${id}`).then(r => r.data),
};

// ── Stock ─────────────────────────────────────────────────────────────────────
export const stockApi = {
  complet: (entrepotId?: string) =>
    api.get('/stock', { params: entrepotId ? { entrepotId } : {} }).then(r => r.data),
  alertes: () => api.get('/stock/alertes').then(r => r.data),
  ecarts: () => api.get('/stock/ecarts').then(r => r.data),
  saisirInventaire: (data: any) => api.post('/stock/inventaire', data).then(r => r.data),
};

// ── Mouvements ────────────────────────────────────────────────────────────────
export const mouvementsApi = {
  list: (params?: Record<string, string>) =>
    api.get('/mouvements', { params }).then(r => r.data),
  get: (id: string) => api.get(`/mouvements/${id}`).then(r => r.data),
  create: (data: any) => api.post('/mouvements', data).then(r => r.data),
  createBatch: (items: any[]) => api.post('/mouvements/batch', { items }).then(r => r.data),
  update: (id: string, data: any) => api.put(`/mouvements/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/mouvements/${id}`).then(r => r.data),
  toggle: (id: string, field: 'envoye' | 'recu') =>
    api.patch(`/mouvements/${id}/toggle/${field}`).then(r => r.data),
  template: () => api.get('/mouvements/template', { responseType: 'blob' }).then(r => r.data as Blob),
  import: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/mouvements/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data); },
};

// ── Commandes ─────────────────────────────────────────────────────────────────
export const commandesApi = {
  list: (params?: Record<string, string>) =>
    api.get('/commandes', { params }).then(r => r.data),
  corbeille: () => api.get('/commandes/corbeille').then(r => r.data),
  restaurer: (id: string) => api.patch(`/commandes/${id}/restaurer`).then(r => r.data),
  supprimerDefinitivement: (id: string) => api.delete(`/commandes/corbeille/${id}`).then(r => r.data),
  viderCorbeille: () => api.delete('/commandes/corbeille/vider').then(r => r.data),
  get: (id: string) => api.get(`/commandes/${id}`).then(r => r.data),
  create: (data: any) => api.post('/commandes', data).then(r => r.data),
  valider: (id: string, data: any) =>
    api.patch(`/commandes/${id}/valider`, data).then(r => r.data),
  expedier: (id: string, data?: { commentaire?: string }) =>
    api.patch(`/commandes/${id}/expedier`, data ?? {}).then(r => r.data),
  marquerLivree: (id: string) =>
    api.patch(`/commandes/${id}/livree`).then(r => r.data),
  annuler: (id: string) => api.patch(`/commandes/${id}/annuler`).then(r => r.data),
  marquerEmailEnvoye: (id: string) =>
    api.patch(`/commandes/${id}/email-envoye`).then(r => r.data),
  marquerBonRetourRecu: (id: string, url?: string) =>
    api.patch(`/commandes/${id}/bon-retour`, { url }).then(r => r.data),
  delete: (id: string) => api.delete(`/commandes/${id}`).then(r => r.data),
  fichePerception: (id: string) =>
    api.get(`/commandes/${id}/fiche-perception`, { responseType: 'blob' }).then(r => r.data),
  // Liens prestataire
  listLiens: () => api.get('/commandes/liens').then(r => r.data),
  genererLien: (nom: string, expiresInDays?: number) =>
    api.post('/commandes/liens', { nom, expiresInDays }).then(r => r.data),
  desactiverLien: (id: string) =>
    api.patch(`/commandes/liens/${id}/desactiver`).then(r => r.data),
  // Public (no auth)
  getPublic: (token: string) =>
    api.get(`/commandes/public/${token}`).then(r => r.data),
  createPublique: (token: string, data: any) =>
    api.post(`/commandes/public/${token}`, data).then(r => r.data),
  suiviPublic: (numero: string) =>
    api.get(`/commandes/public/suivi/${encodeURIComponent(numero)}`).then(r => r.data),
  template: () => api.get('/commandes/template', { responseType: 'blob' }).then(r => r.data as Blob),
  import: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/commandes/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data); },
};

// ── Livraisons ────────────────────────────────────────────────────────────────
export const livraisonsApi = {
  list: (params?: Record<string, string | undefined>) =>
    api.get('/livraisons', { params }).then(r => r.data),
  corbeille: () => api.get('/livraisons/corbeille').then(r => r.data),
  restaurer: (id: string) => api.patch(`/livraisons/${id}/restaurer`).then(r => r.data),
  supprimerDefinitivement: (id: string) => api.delete(`/livraisons/corbeille/${id}`).then(r => r.data),
  viderCorbeille: () => api.delete('/livraisons/corbeille/vider').then(r => r.data),
  get: (id: string) => api.get(`/livraisons/${id}`).then(r => r.data),
  create: (data: any) => api.post('/livraisons', data).then(r => r.data),
  updateStatut: (id: string, data: any) =>
    api.patch(`/livraisons/${id}/statut`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/livraisons/${id}`).then(r => r.data),
  template: () => api.get('/livraisons/template', { responseType: 'blob' }).then(r => r.data as Blob),
  import: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/livraisons/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data); },
};

// ── Uploads ───────────────────────────────────────────────────────────────────
export const uploadsApi = {
  uploadFichier: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/uploads/fichier', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  parseExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/uploads/excel/parse', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

// ── Utilisateurs ─────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users').then(r => r.data),
  create: (data: any) => api.post('/users', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data).then(r => r.data),
  toggleActif: (id: string) => api.patch(`/users/${id}/toggle-actif`).then(r => r.data),
  updatePrivileges: (id: string, privileges: any) => api.put(`/users/${id}/privileges`, privileges).then(r => r.data),
  export: () => api.get('/users/export', { responseType: 'blob' }).then(r => r.data as Blob),
};

// ── Inventaires ───────────────────────────────────────────────────────────────
export const inventairesApi = {
  list: (params?: Record<string, string>) => api.get('/inventaires', { params }).then(r => r.data),
  alertes: () => api.get('/inventaires/alertes').then(r => r.data),
  etatEntrepot: (entrepotId: string) => api.get('/inventaires/entrepot', { params: { entrepotId } }).then(r => r.data),
  create: (data: any) => api.post('/inventaires', data).then(r => r.data),
  template: () => api.get('/inventaires/template', { responseType: 'blob' }).then(r => r.data as Blob),
  import: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/inventaires/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data); },
};

// ── Commandes TS ──────────────────────────────────────────────────────────────
export const commandesTSApi = {
  list: () => api.get('/commandes-ts').then(r => r.data),
  corbeille: () => api.get('/commandes-ts/corbeille').then(r => r.data),
  restaurer: (id: string) => api.patch(`/commandes-ts/${id}/restaurer`).then(r => r.data),
  supprimerDefinitivement: (id: string) => api.delete(`/commandes-ts/corbeille/${id}`).then(r => r.data),
  viderCorbeille: () => api.delete('/commandes-ts/corbeille/vider').then(r => r.data),
  get: (id: string) => api.get(`/commandes-ts/${id}`).then(r => r.data),
  kpis: (id: string) => api.get(`/commandes-ts/${id}/kpis`).then(r => r.data),
  create: (data: any) => api.post('/commandes-ts', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/commandes-ts/${id}`, data).then(r => r.data),
  cloturer: (id: string) => api.put(`/commandes-ts/${id}/cloturer`).then(r => r.data),
  updateLigne: (ligneId: string, data: any) => api.put(`/commandes-ts/lignes/${ligneId}`, data).then(r => r.data),
  updateRepartition: (repartitionId: string, data: any) => api.put(`/commandes-ts/repartitions/${repartitionId}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/commandes-ts/${id}`).then(r => r.data),
  template: () => api.get('/commandes-ts/template', { responseType: 'blob' }).then(r => r.data as Blob),
  import: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/commandes-ts/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data); },
};

// ── Répertoire (Sociétés + Intervenants) ──────────────────────────────────────
export const repertoireApi = {
  // Sociétés
  listSocietes: () => api.get('/repertoire/societes').then(r => r.data),
  listSocietesActives: () => api.get('/repertoire/societes/actives').then(r => r.data),
  createSociete: (data: any) => api.post('/repertoire/societes', data).then(r => r.data),
  updateSociete: (id: string, data: any) => api.put(`/repertoire/societes/${id}`, data).then(r => r.data),
  deleteSociete: (id: string) => api.delete(`/repertoire/societes/${id}`).then(r => r.data),
  templateSocietes: () => api.get('/repertoire/societes/template', { responseType: 'blob' }).then(r => r.data as Blob),
  importSocietes: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/repertoire/societes/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data); },
  // Intervenants
  listIntervenants: (societeId?: string) => api.get('/repertoire/intervenants', { params: societeId ? { societeId } : {} }).then(r => r.data),
  listIntervenantsActifs: () => api.get('/repertoire/intervenants/actifs').then(r => r.data),
  createIntervenant: (data: any) => api.post('/repertoire/intervenants', data).then(r => r.data),
  updateIntervenant: (id: string, data: any) => api.put(`/repertoire/intervenants/${id}`, data).then(r => r.data),
  deleteIntervenant: (id: string) => api.delete(`/repertoire/intervenants/${id}`).then(r => r.data),
  templateIntervenants: () => api.get('/repertoire/intervenants/template', { responseType: 'blob' }).then(r => r.data as Blob),
  importIntervenants: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/repertoire/intervenants/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data); },
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => api.get('/notifications').then(r => r.data),
  count: () => api.get('/notifications/count').then(r => r.data),
  marquerLue: (id: string) => api.patch(`/notifications/${id}/lire`).then(r => r.data),
  marquerToutesLues: () => api.patch('/notifications/lire-toutes').then(r => r.data),
};
