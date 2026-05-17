// Theme definitions
export const THEMES = [
  {
    id: 'cyber-dark',
    name: 'Cyber Dark',
    description: 'Default dark cyberpunk theme',
    preview: ['#0d0d12', '#00f0ff', '#fcee0a'],
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    description: 'Deep blue dark theme',
    preview: ['#0a0e1a', '#4f8ef7', '#a78bfa'],
  },
  {
    id: 'neon-purple',
    name: 'Neon Purple',
    description: 'Dark theme with purple accents',
    preview: ['#0d0a1a', '#c084fc', '#f0abfc'],
  },
  {
    id: 'light',
    name: 'Light Mode',
    description: 'Clean light theme',
    preview: ['#f8fafc', '#0ea5e9', '#6366f1'],
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Dark green nature theme',
    preview: ['#0a1a0e', '#3ecf8e', '#86efac'],
  },
  {
    id: 'retro-earthy',
    name: 'Retro Earthy',
    description: 'Warm retro palette with earthy tones',
    preview: ['#F5EFE0', '#B5706A', '#C4963A', '#4A7A8A'],
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    description: 'Elegant pink and gold tones',
    preview: ['#1a0a0f', '#f43f5e', '#fbbf24'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep sea blues and teals',
    preview: ['#020c1b', '#06b6d4', '#0ea5e9'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange and red gradients',
    preview: ['#1a0a00', '#f97316', '#ef4444'],
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Clean black and white',
    preview: ['#111111', '#ffffff', '#888888'],
  },
];

export function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('nexo-theme', themeId);
}

export function loadTheme() {
  const saved = localStorage.getItem('nexo-theme') || 'cyber-dark';
  applyTheme(saved);
  return saved;
}
