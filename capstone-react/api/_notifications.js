import { supabaseAdmin } from './_supabase.js';
import { notificationCategory } from '../src/lib/constants.js';

/**
 * Insert a notification with grouping and muting support.
 * - If user has muted the category, skip insert.
 * - If a notification with the same group_key exists within 10 minutes, increment count.
 * - Otherwise insert a new notification row.
 */
export async function insertNotification({ userId, type, message, groupKey, category }) {
  if (!userId) return;

  // Resolve category from type if not provided
  const cat = category || notificationCategory(type);

  // Check if user has muted this category
  const { data: mute } = await supabaseAdmin
    .from('notification_mutes')
    .select('user_id')
    .eq('user_id', userId)
    .eq('category', cat)
    .maybeSingle();
  if (mute) return; // muted — skip

  // Check for existing grouped notification within last 10 minutes
  if (groupKey) {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('notifications')
      .select('id, group_count, message')
      .eq('user_id', userId)
      .eq('group_key', groupKey)
      .eq('is_read', false)
      .gte('created_at', tenMinsAgo)
      .maybeSingle();

    if (existing) {
      const newCount = (existing.group_count || 1) + 1;
      // Replace count in message e.g. "2 people..." -> "3 people..."
      const updatedMsg = message.replace(/^\d+ people/, `${newCount} people`);
      await supabaseAdmin
        .from('notifications')
        .update({ group_count: newCount, message: updatedMsg })
        .eq('id', existing.id);
      return;
    }
  }

  // Insert new notification
  await supabaseAdmin.from('notifications').insert([{
    user_id: userId,
    type,
    message,
    group_key: groupKey || null,
    group_count: 1,
    category: cat,
  }]);
}
