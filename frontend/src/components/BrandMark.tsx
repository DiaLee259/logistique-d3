interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  light?: boolean;
}

export default function BrandMark({ size = 'md', light = true }: BrandMarkProps) {
  const titleSize = size === 'lg' ? '1.6rem' : size === 'md' ? '1.25rem' : '0.95rem';
  const subSize   = size === 'lg' ? '0.65rem' : size === 'md' ? '0.55rem' : '0.48rem';
  const gap       = size === 'lg' ? '4px' : '2px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap }}>
      <span style={{
        fontFamily: "'Rajdhani', 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
        fontWeight: 700,
        fontSize: titleSize,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: light ? '#ffffff' : 'hsl(var(--foreground))',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        TECHNO SMART
      </span>
      <span style={{
        fontFamily: "'Rajdhani', 'Barlow Condensed', Arial, sans-serif",
        fontWeight: 600,
        fontSize: subSize,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: light ? 'rgba(147,197,253,0.7)' : 'hsl(var(--muted-foreground))',
        lineHeight: 1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}>
        La puissance du réseau intelligent
      </span>
    </div>
  );
}
