// Profile Customization System
import { supabase } from './supabase';

// Load user's active customizations
export async function loadUserCustomizations(userId) {
  try {
    const { data, error } = await supabase
      .from('user_profile_settings')
      .select(`
        *,
        theme:active_theme(*),
        badge:active_badge(*),
        background:active_background(*),
        name_color:active_name_color(*)
      `)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to load customizations:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error loading customizations:', err);
    return null;
  }
}

// Apply theme to root CSS variables
export function applyTheme(themeItem) {
  if (!themeItem?.css_data) return;

  const root = document.documentElement;
  const data = themeItem.css_data;

  if (data.primary) {
    root.style.setProperty('--cyber-cyan', data.primary);
  }
  if (data.secondary) {
    root.style.setProperty('--secondary-color', data.secondary);
  }
  if (data.gradient) {
    root.style.setProperty('--theme-gradient', data.gradient);
  }
}

// Get badge emoji/icon for a user
export function getUserBadge(customizations) {
  if (!customizations?.badge?.preview_url) return null;
  return customizations.badge.preview_url;
}

// Get username color style for a user
export function getUserNameStyle(customizations) {
  if (!customizations?.name_color?.css_data) return {};

  const data = customizations.name_color.css_data;

  if (data.gradient) {
    return {
      background: data.gradient,
      backgroundSize: '100% 100%',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
      fontWeight: 700,
      display: 'inline-block'
    };
  }

  if (data.color) {
    return {
      color: data.color,
      fontWeight: 700
    };
  }

  return {};
}

// Get profile background style
export function getProfileBackgroundStyle(customizations) {
  if (!customizations?.background?.css_data) return {};

  const data = customizations.background.css_data;
  const style = {};

  if (data.pattern) {
    style.backgroundImage = data.pattern;
    if (data.size) style.backgroundSize = data.size;
  }

  if (data.image) {
    style.backgroundImage = data.image;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  }

  return style;
}

// Cache for customizations (reduce database calls)
const customizationCache = new Map();

export async function getCachedCustomizations(userId) {
  if (customizationCache.has(userId)) {
    return customizationCache.get(userId);
  }

  const customs = await loadUserCustomizations(userId);
  customizationCache.set(userId, customs);
  
  // Clear cache after 5 minutes
  setTimeout(() => customizationCache.delete(userId), 5 * 60 * 1000);

  return customs;
}

export function clearCustomizationCache(userId) {
  if (userId) {
    customizationCache.delete(userId);
  } else {
    customizationCache.clear();
  }
}
