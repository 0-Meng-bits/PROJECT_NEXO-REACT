// Single source of truth for shared constants across the NEXO Connect platform

// YouTube tutorial/promotional video embed URL
// Update this single value to change the embed across Landing, HelpModal, and Onboarding
// Set to null or empty string to show "Coming Soon" placeholder instead
export const NEXO_YOUTUBE_EMBED_URL = '';

// Maps circle categories to their relevant interest tags
// Used in circle creation form and interest filtering
export const CATEGORY_INTEREST_MAP = {
  Academic:  ['research', 'debate', 'business', 'language_learning', 'robotics', 'reading'],
  Hobby:     ['coding', 'design', 'gaming', 'music', 'art', 'photography', 'writing',
              'cooking', 'anime', 'fitness', 'podcasting', 'esports', 'dancing', 'bl_gl'],
  Social:    ['sports', 'travel', 'fitness', 'dancing', 'esports'],
  Project:   ['coding', 'robotics', 'design', 'business', 'research'],
};

// Human-readable labels for interest tags
export const INTEREST_LABELS = {
  research:         'Research',
  debate:           'Debate',
  business:         'Business',
  language_learning:'Language Learning',
  robotics:         'Robotics',
  reading:          'Reading',
  coding:           'Coding',
  design:           'Design',
  gaming:           'Gaming',
  music:            'Music',
  art:              'Art',
  photography:      'Photography',
  writing:          'Writing',
  cooking:          'Cooking',
  anime:            'Anime',
  fitness:          'Fitness',
  podcasting:       'Podcasting',
  esports:          'E-Sports',
  dancing:          'Dancing',
  bl_gl:            'Watching BL/GL',
  sports:           'Sports',
  travel:           'Travel',
};

// All valid notification types — used for category mapping and testing
export const ALL_NOTIFICATION_TYPES = [
  // Connections category
  'connection_request',
  'connection_accepted',
  'connection_declined',
  // Circles category
  'circle_invite',
  'join_approved',
  'join_denied',
  'kicked',
  'promoted',
  'circle_dissolved',
  'solution_marked',
  // Campus category
  'new_announcement',
  'campus_event',
  'application_update',
  'audition_update',
];

// Maps notification type to its display category
export function notificationCategory(type) {
  const map = {
    connection_request:   'Connections',
    connection_accepted:  'Connections',
    connection_declined:  'Connections',
    circle_invite:        'Circles',
    join_approved:        'Circles',
    join_denied:          'Circles',
    kicked:               'Circles',
    promoted:             'Circles',
    circle_dissolved:     'Circles',
    solution_marked:      'Circles',
    new_announcement:     'Campus',
    campus_event:         'Campus',
    application_update:   'Campus',
    audition_update:      'Campus',
  };
  return map[type] || 'Campus';
}
