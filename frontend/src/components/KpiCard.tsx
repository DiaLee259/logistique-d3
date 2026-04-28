import { LucideIcon } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  trend?: { value: number; label: string };
  onClick?: () => void;
}

const variants = {
  default: { card: 'bg-card', icon: 'bg-primary/10 text-primary', value: 'text-foreground' },
  success: { card: 'bg-card', icon: 'bg-green-100 text-green-700', value: 'text-green-700' },
  warning: { card: 'bg-card', icon: 'bg-amber-100 text-amber-700', value: 'text-amber-700' },
  danger: { card: 'bg-card', icon: 'bg-red-100 text-red-700', value: 'text-red-700' },
  info: { card: 'bg-card', icon: 'bg-cyan-100 text-cyan-700', value: 'text-cyan-700' },
};

export default function KpiCard({ title, value, subtitle, icon: Icon, variant = 'default', trend, onClick }: KpiCardProps) {
  const v = variants[variant];
  return (
    <div
      className={cn(
        'rounded-xl border border-border p-4 shadow-sm transition-shadow',
        v.card,
        onClick && 'cursor-pointer hover:shadow-md',
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
          <p className={cn('text-2xl font-bold mt-1', v.value)}>
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          {trend && (
            <p className={cn('text-xs mt-1 font-medium', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg flex-shrink-0', v.icon)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
