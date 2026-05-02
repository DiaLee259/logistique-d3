import { LOGO_BASE64 } from '@/assets/logo-base64';

interface LogoProps {
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  /** 'full' = logo complet | 'icon' = icône TS (carré gauche) */
  variant?: 'full' | 'icon';
}

export default function Logo({ height = 40, className = '', style, variant = 'full' }: LogoProps) {
  if (variant === 'icon') {
    return (
      <div style={{ width: height, height, overflow: 'hidden', borderRadius: 6, flexShrink: 0 }}>
        <img
          src={LOGO_BASE64}
          alt="TS"
          style={{ height, width: 'auto', objectFit: 'cover', objectPosition: '0% center' }}
        />
      </div>
    );
  }

  return (
    <img
      src={LOGO_BASE64}
      alt="TechnoSmart"
      className={className}
      style={{ height, width: 'auto', objectFit: 'contain', display: 'block', ...style }}
    />
  );
}
