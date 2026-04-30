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
