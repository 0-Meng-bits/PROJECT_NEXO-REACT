import { supabaseAdmin } from './_supabase.js';

// Profile Customization Shop API
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ── GET SHOP ITEMS ──────────────────────────────────────────
    if (req.method === 'GET') {
      const { data: items, error } = await supabaseAdmin
        .from('shop_items')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;
      return res.json(items || []);
    }

    // ── POST ACTIONS ────────────────────────────────────────────
    const { action, userId, itemId } = req.body;

    // ── BUY ITEM ────────────────────────────────────────────────
    if (action === 'buy-item') {
      if (!userId || !itemId) {
        return res.status(400).json({ error: 'Missing userId or itemId' });
      }

      // Get item details
      const { data: item, error: itemError } = await supabaseAdmin
        .from('shop_items')
        .select('*')
        .eq('id', itemId)
        .eq('is_active', true)
        .single();

      if (itemError || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Check if already owned
      const { data: existing } = await supabaseAdmin
        .from('user_purchases')
        .select('id')
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .single();

      if (existing) {
        return res.status(400).json({ error: 'You already own this item' });
      }

      // Get user's current trust points
      const { data: userPoints } = await supabaseAdmin
        .from('account_status')
        .select('trust_points')
        .eq('id', userId)
        .single();

      const currentPoints = userPoints?.trust_points || 0;

      if (currentPoints < item.price) {
        return res.status(400).json({ 
          error: `Not enough trust points. You have ${currentPoints}, need ${item.price}` 
        });
      }

      // Deduct points
      const newPoints = currentPoints - item.price;
      const { error: pointsError } = await supabaseAdmin
        .from('account_status')
        .update({ trust_points: newPoints })
        .eq('id', userId);

      if (pointsError) throw pointsError;

      // Add purchase
      const { error: purchaseError } = await supabaseAdmin
        .from('user_purchases')
        .insert([{ user_id: userId, item_id: itemId }]);

      if (purchaseError) {
        // Rollback points if purchase fails
        await supabaseAdmin
          .from('account_status')
          .update({ trust_points: currentPoints })
          .eq('id', userId);
        throw purchaseError;
      }

      // Log transaction
      await supabaseAdmin.from('point_transactions').insert([{
        user_id: userId,
        amount: -item.price,
        transaction_type: 'shop_purchase',
        reason: `Bought: ${item.name}`
      }]);

      return res.json({ 
        success: true, 
        newPoints,
        item 
      });
    }

    // ── GET USER PURCHASES ──────────────────────────────────────
    if (action === 'get-purchases') {
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      const { data: purchases, error } = await supabaseAdmin
        .from('user_purchases')
        .select('*, shop_items(*)')
        .eq('user_id', userId);

      if (error) throw error;
      return res.json(purchases || []);
    }

    // ── APPLY CUSTOMIZATION ─────────────────────────────────────
    if (action === 'apply-customization') {
      const { type, itemId: applyItemId } = req.body;

      if (!userId || !type) {
        return res.status(400).json({ error: 'Missing userId or type' });
      }

      // Verify user owns the item
      if (applyItemId) {
        const { data: owned } = await supabaseAdmin
          .from('user_purchases')
          .select('id')
          .eq('user_id', userId)
          .eq('item_id', applyItemId)
          .single();

        if (!owned) {
          return res.status(403).json({ error: 'You do not own this item' });
        }
      }

      // Update profile settings
      const updateData = {};
      updateData[`active_${type}`] = applyItemId;

      const { error } = await supabaseAdmin
        .from('user_profile_settings')
        .upsert({ 
          user_id: userId, 
          ...updateData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      return res.json({ success: true });
    }

    // ── GET USER SETTINGS ───────────────────────────────────────
    if (action === 'get-settings') {
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      const { data: settings, error } = await supabaseAdmin
        .from('user_profile_settings')
        .select(`
          *,
          theme:active_theme(*),
          badge:active_badge(*),
          background:active_background(*),
          name_color:active_name_color(*),
          avatar_border:active_avatar_border(*),
          music:active_music(*)
        `)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return res.json(settings || null);
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.error('Shop error:', err);
    return res.status(500).json({ error: err.message });
  }
}
