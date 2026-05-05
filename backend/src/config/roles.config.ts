// ─── Rôles disponibles ────────────────────────────────────────────────────────
// Pour ajouter un nouveau rôle : ajouter une entrée ici, c'est suffisant.
// Aucune migration DB nécessaire (le rôle est stocké en TEXT).
export const ROLES = [
  'ADMIN',
  'LOGISTICIEN_1',
  'LOGISTICIEN_2',
  'CHEF_PROJET',
  'MANAGER_ZONE',
] as const;

export type RoleKey = typeof ROLES[number];
