import { THEMES, applyTheme } from '../lib/theme';

export default function ThemePicker({ currentTheme, onClose, onThemeChange }) {
  const handleSelect = (themeId) => {
    applyTheme(themeId);
    onThemeChange(themeId);
  };

  return (
    <div className="theme-picker-overlay" onClick={onClose}>
      <div className="theme-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="theme-picker-title">
          <i className="fa-solid fa-palette" style={{ marginRight: 10, color: 'var(--cyber-cyan)' }} />
          APPEARANCE
        </div>
        <p className="theme-picker-sub">Choose a theme for your NEXO experience</p>

        <div className="theme-grid">
          {THEMES.map(theme => (
            <div
              key={theme.id}
              className={`theme-card ${currentTheme === theme.id ? 'active' : ''}`}
              onClick={() => handleSelect(theme.id)}
            >
              <div className="theme-preview-dots">
                {theme.preview.map((color, i) => (
                  <div key={i} className="theme-dot" style={{ background: color }} />
                ))}
              </div>
              <div className="theme-card-name">{theme.name}</div>
              <div className="theme-card-desc">{theme.description}</div>
            </div>
          ))}
        </div>

        <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
