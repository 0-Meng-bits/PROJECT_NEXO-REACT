import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;
  console.log('[DELETE API]', { action, body: req.body });

  try {
    // ── DELETE COMMUNITY ────────────────────────────────────────────────
    if (action === 'delete-community') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing community id' });

      console.log('[DELETE COMMUNITY]', { id });
      const { error } = await supabaseAdmin.from('communities').delete().eq('id', id);
      if (error) {
        console.error('[DELETE COMMUNITY ERROR]', error);
        return res.status(400).json({ error: error.message });
      }
      console.log('[DELETE COMMUNITY SUCCESS]');
      return res.json({ ok: true });
    }

    // ── DELETE USER ─────────────────────────────────────────────────────
    if (action === 'delete-user') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing user id' });

      const { error } = await supabaseAdmin.from('accounts').delete().eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: err.message });
  }
}
