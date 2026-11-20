import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  try {

    // ── FLAG ACCOUNT FOR DELETION (warning period) ───────────────────────
    if (action === 'flag-deletion-user') {
      const { id, reason, adminId } = req.body;
      if (!id || !reason) return res.status(400).json({ error: 'Missing id or reason' });

      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabaseAdmin.from('account_status').update({
        deletion_pending: true,
        deletion_reason: reason,
        deletion_flagged_at: new Date().toISOString(),
        deletion_deadline: deadline,
      }).eq('id', id);
      if (error) return res.status(400).json({ error: error.message });

      // Notify the user
      const deadlineStr = new Date(deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      await supabaseAdmin.from('notifications').insert([{
        user_id: id,
        type: 'system',
        message: `⚠️ Your account has been flagged for deletion. Reason: "${reason}". You have until ${deadlineStr} to appeal this decision. Open a Support Ticket from the Help Center to submit your appeal.`,
        category: 'Campus',
      }]);

      return res.json({ ok: true, deadline });
    }

    // ── FLAG CIRCLE FOR DELETION (warning period) ────────────────────────
    if (action === 'flag-deletion-circle') {
      const { id, reason, leaderId } = req.body;
      if (!id || !reason) return res.status(400).json({ error: 'Missing id or reason' });

      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabaseAdmin.from('communities').update({
        deletion_pending: true,
        deletion_reason: reason,
        deletion_flagged_at: new Date().toISOString(),
        deletion_deadline: deadline,
      }).eq('id', id);
      if (error) return res.status(400).json({ error: error.message });

      // Notify the circle leader if provided
      if (leaderId) {
        const deadlineStr = new Date(deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        // Get circle name for the notification
        const { data: circle } = await supabaseAdmin.from('communities').select('name').eq('id', id).single();
        await supabaseAdmin.from('notifications').insert([{
          user_id: leaderId,
          type: 'system',
          message: `⚠️ Your circle "${circle?.name || 'Unknown'}" has been flagged for deletion. Reason: "${reason}". You have until ${deadlineStr} to appeal. Open a Support Ticket from the Help Center to submit your appeal.`,
          category: 'Circles',
        }]);
      }

      return res.json({ ok: true, deadline });
    }

    // ── DISMISS DELETION FLAG (admin clears the warning) ─────────────────
    if (action === 'dismiss-deletion-user') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const { error } = await supabaseAdmin.from('account_status').update({
        deletion_pending: false,
        deletion_reason: null,
        deletion_flagged_at: null,
        deletion_deadline: null,
      }).eq('id', id);
      if (error) return res.status(400).json({ error: error.message });

      // Notify the user that the flag was removed
      await supabaseAdmin.from('notifications').insert([{
        user_id: id,
        type: 'system',
        message: '✅ The deletion flag on your account has been dismissed. Your account is safe.',
        category: 'Campus',
      }]);

      return res.json({ ok: true });
    }

    if (action === 'dismiss-deletion-circle') {
      const { id, leaderId } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const { data: circle } = await supabaseAdmin.from('communities').select('name').eq('id', id).single();

      const { error } = await supabaseAdmin.from('communities').update({
        deletion_pending: false,
        deletion_reason: null,
        deletion_flagged_at: null,
        deletion_deadline: null,
      }).eq('id', id);
      if (error) return res.status(400).json({ error: error.message });

      if (leaderId) {
        await supabaseAdmin.from('notifications').insert([{
          user_id: leaderId,
          type: 'system',
          message: `✅ The deletion flag on your circle "${circle?.name || 'Unknown'}" has been dismissed. Your circle is safe.`,
          category: 'Circles',
        }]);
      }

      return res.json({ ok: true });
    }

    // ── CONFIRM DELETE COMMUNITY ─────────────────────────────────────────
    if (action === 'delete-community') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing community id' });

      const { error } = await supabaseAdmin.from('communities').delete().eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    }

    // ── CONFIRM DELETE USER ──────────────────────────────────────────────
    if (action === 'delete-user') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing user id' });

      // Delete from accounts table (cascades to account_status, account_details, etc.)
      const { error } = await supabaseAdmin.from('accounts').delete().eq('id', id);
      if (error) return res.status(400).json({ error: error.message });

      // Also delete the auth user so they can re-register with same email/ID
      await supabaseAdmin.auth.admin.deleteUser(id);

      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: err.message });
  }
}
