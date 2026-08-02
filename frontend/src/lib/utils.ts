import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy') {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt, { locale: fr });
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n);
}

export function statutCommandeLabel(s: string) {
  const map: Record<string, string> = {
    EN_ATTENTE: 'En attente',
    EN_VALIDATION: 'En validation',
    VALIDEE: 'Validée Log1',
    EN_ATTENTE_LOG2: 'Att. Log2',
    EXPEDIEE: 'Expédiée',
    LIVREE: 'Livrée',
    ANNULEE: 'Annulée',
  };
  return map[s] ?? s;
}

export function statutCommandeColor(s: string) {
  const map: Record<string, string> = {
    EN_ATTENTE: 'bg-amber-100 text-amber-800 border-amber-200',
    EN_VALIDATION: 'bg-blue-100 text-blue-800 border-blue-200',
    VALIDEE: 'bg-green-100 text-green-800 border-green-200',
    EN_ATTENTE_LOG2: 'bg-orange-100 text-orange-800 border-orange-200',
    EXPEDIEE: 'bg-purple-100 text-purple-800 border-purple-200',
    LIVREE: 'bg-gray-100 text-gray-700 border-gray-200',
    ANNULEE: 'bg-red-100 text-red-700 border-red-200',
  };
  return map[s] ?? 'bg-gray-100 text-gray-700';
}

export function roleLabel(r: string) {
  const map: Record<string, string> = {
    ADMIN: 'Administrateur',
    LOGISTICIEN_1: 'Logisticien 1',
    LOGISTICIEN_2: 'Logisticien 2',
    CHEF_PROJET: 'Chef de projet',
  };
  return map[r] ?? r;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
