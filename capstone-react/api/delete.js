import { supabaseAdmin } from './_supabase.js';

const DEADLINE_DAYS = 7;

function makeDeadline() {
  return new Date(Date.now() + DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  try {

    // ── FLAG ACCOUNT FOR DELETION ────────────────────────────────────────
    if (action === 'flag-deletion-user') {
      const { id, reason, adminId } = req.body;
      if (!id || !reason) return res.status(400).json({ error: 'Missing id or reason' });

      const deadline = makeDeadline();

      const { error } = await supabaseAdmin.from('account_deletion_warnings').upsert([{
        account_id: id,
        reason,
        flagged_by: adminId || null,
        flagged_at: new Date().toISOString(),
        deadline,
        status: 'pending',
        resolved_at: null,
      }], { onConflict: 'account_id,status' });
      if (error) return res.status(400).json({ error: error.message });

      const deadlineStr = new Date(deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      await supabaseAdmin.from('notifications').insert([{
        user_id: id,
        type: 'system',
        message: `⚠️ Your account has been flagged for deletion. Reason: "${reason}". You have until ${deadlineStr} to appeal. Open a Support Ticket from the Help Center to submit your appeal.`,
        category: 'Campus',
      }]);

      return res.json({ ok: true, deadline });
    }

    // ── FLAG CIRCLE FOR DELETION ─────────────────────────────────────────
    if (action === 'flag-deletion-circle') {
      const { id, reason, leaderId, adminId } = req.body;
      if (!id || !reason) return res.status(400).json({ error: 'Missing id or reason' });

      const deadline = makeDeadline();

      const { error } = await supabaseAdmin.from('community_deletion_warnings').upsert([{
        community_id: id,
        reason,
        flagged_by: adminId || null,
        flagged_at: new Date().toISOString(),
        deadline,
        status: 'pending',
        resolved_at: null,
      }], { onConflict: 'community_id,status' });
      if (error) return res.status(400).json({ error: error.message });

      if (leaderId) {
        const { data: circle } = await supabaseAdmin.from('communities').select('name').eq('id', id).single();
        const deadlineStr = new Date(deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

      const { error } = await supabaseAdmin.from('account_deletion_warnings')
        .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
        .eq('account_id', id).eq('status', 'pending');
      if (error) return res.status(400).json({ error: error.message });

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

      const { error } = await supabaseAdmin.from('community_deletion_warnings')
        .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
        .eq('community_id', id).eq('status', 'pending');
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

      await supabaseAdmin.from('community_deletion_warnings')
        .update({ status: 'confirmed', resolved_at: new Date().toISOString() })
        .eq('community_id', id).eq('status', 'pending');

      const { error } = await supabaseAdmin.from('communities').delete().eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    }

    // ── CONFIRM DELETE USER ──────────────────────────────────────────────
    if (action === 'delete-user') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing user id' });

      await supabaseAdmin.from('account_deletion_warnings')
        .update({ status: 'confirmed', resolved_at: new Date().toISOString() })
        .eq('account_id', id).eq('status', 'pending');

      // Delete from accounts (cascades to account_status, account_details, etc.)
      const { error } = await supabaseAdmin.from('accounts').delete().eq('id', id);
      if (error) return res.status(400).json({ error: error.message });

      // Delete Supabase Auth user so email/ID can be reused
      await supabaseAdmin.auth.admin.deleteUser(id);

      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: err.message });
  }
}
