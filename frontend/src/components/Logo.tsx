/**
 * Composant Logo TechnoSmart
 * Utilise l'import Vite (bundlé) avec fallback public path.
 */

let logoSrc: string = '/logo-ts.jpg'; // fallback public path

try {
  // Import dynamique résolu par Vite au build
  logoSrc = new URL('../assets/logo-ts.jpg', import.meta.url).href;
} catch {
  logoSrc = '/logo-ts.jpg';
}

interface LogoProps {
  /** Hauteur en pixels */
  height?: number;
  className?: string;
  /** 'full' = logo complet, 'icon' = carré rognage gauche (icône TS) */
  variant?: 'full' | 'icon';
}

export default function Logo({ height = 40, className = '', variant = 'full' }: LogoProps) {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.src.endsWith('/logo-ts.jpg')) {
      img.src = '/logo-ts.jpg';
    }
  };

  if (variant === 'icon') {
    return (
      <div
        style={{
          width: height,
          height: height,
          overflow: 'hidden',
          borderRadius: 6,
          flexShrink: 0,
        }}
      >
        <img
          src={logoSrc}
          alt="TS"
          onError={handleError}
          style={{
            height: height,
            width: 'auto',
            objectFit: 'cover',
            objectPosition: '0% center',
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={logoSrc}
      alt="TechnoSmart"
      onError={handleError}
      className={className}
      style={{ height, width: 'auto', objectFit: 'contain' }}
    />
  );
}
