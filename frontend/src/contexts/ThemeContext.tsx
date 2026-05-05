import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeName =
  | 'light' | 'dark'
  | 'ocean' | 'foret' | 'ardoise' | 'amethyste' | 'aurore'
  | 'corail' | 'lavande' | 'menthe' | 'ciel' | 'bordeaux' | 'pivoine';

export const THEMES: { name: ThemeName; label: string; primary: string; bg: string; dark: boolean }[] = [
  // Clairs
  { name: 'light',      label: 'Clair',      primary: '#2563eb', bg: '#f4f6fa', dark: false },
  { name: 'corail',     label: 'Corail',     primary: '#e04a28', bg: '#faf5f0', dark: false },
  { name: 'lavande',    label: 'Lavande',    primary: '#7c4dcc', bg: '#f8f7ff', dark: false },
  { name: 'menthe',     label: 'Menthe',     primary: '#1e9e5a', bg: '#f3faf5', dark: false },
  { name: 'ciel',       label: 'Ciel',       primary: '#1a7dd6', bg: '#f0f6fd', dark: false },
  { name: 'pivoine',    label: 'Pivoine',    primary: '#c4557a', bg: '#fdf7f9', dark: false },
  // Sombres
  { name: 'dark',       label: 'Sombre',     primary: '#4d88ff', bg: '#1e2330', dark: true  },
  { name: 'ocean',      label: 'Océan',      primary: '#2ab8b8', bg: '#0e1929', dark: true  },
  { name: 'foret',      label: 'Forêt',      primary: '#2d9e5a', bg: '#0b1a10', dark: true  },
  { name: 'ardoise',    label: 'Ardoise',    primary: '#3b8ec4', bg: '#171d26', dark: true  },
  { name: 'amethyste',  label: 'Améthyste',  primary: '#8b5cf6', bg: '#16101e', dark: true  },
  { name: 'aurore',     label: 'Aurore',     primary: '#e09a20', bg: '#171009', dark: true  },
  { name: 'bordeaux',   label: 'Bordeaux',   primary: '#d94f72', bg: '#1a0b10', dark: true  },
];

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggle: () => {},
});

const THEME_CLASSES = [
  'theme-ocean', 'theme-foret', 'theme-ardoise', 'theme-amethyste', 'theme-aurore',
  'theme-corail', 'theme-lavande', 'theme-menthe', 'theme-ciel', 'theme-bordeaux', 'theme-pivoine',
];

function applyTheme(name: ThemeName) {
  const root = document.documentElement;
  root.classList.remove('dark', ...THEME_CLASSES);

  const t = THEMES.find(t => t.name === name);
  if (!t) return;

  if (t.dark) root.classList.add('dark');
  if (!['light', 'dark'].includes(name)) root.classList.add(`theme-${name}`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    return (localStorage.getItem('theme') as ThemeName) || 'light';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (t: ThemeName) => setThemeState(t);
  const toggle = () => setThemeState(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
