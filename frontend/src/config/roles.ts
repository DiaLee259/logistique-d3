// ─── Rôles disponibles ────────────────────────────────────────────────────────
// Pour ajouter un rôle : ajouter une entrée ici + dans backend/src/config/roles.config.ts
export const ROLES_CONFIG = [
  {
    value: 'ADMIN',
    label: 'Administrateur',
    shortLabel: 'Admin',
    color: 'bg-red-100 text-red-700',
  },
  {
    value: 'LOGISTICIEN_1',
    label: 'Logisticien 1 (Backoffice)',
    shortLabel: 'Log. Backoffice',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'LOGISTICIEN_2',
    label: 'Logisticien 2 (Terrain)',
    shortLabel: 'Log. Terrain',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    value: 'CHEF_PROJET',
    label: 'Chef de projet',
    shortLabel: 'Chef projet',
    color: 'bg-green-100 text-green-700',
  },
  {
    value: 'MANAGER_ZONE',
    label: 'Manager de zone',
    shortLabel: 'Manager zone',
    color: 'bg-orange-100 text-orange-700',
  },
] as const;

export function getRoleConfig(role: string) {
  return ROLES_CONFIG.find(r => r.value === role);
}

export function getRoleLabel(role: string) {
  return getRoleConfig(role)?.label ?? role;
}

export function getRoleShortLabel(role: string) {
  return getRoleConfig(role)?.shortLabel ?? role;
}

export function getRoleColor(role: string) {
  return getRoleConfig(role)?.color ?? 'bg-gray-100 text-gray-700';
}
