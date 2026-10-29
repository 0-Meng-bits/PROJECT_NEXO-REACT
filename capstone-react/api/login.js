import { supabase, supabaseAdmin } from './_supabase.js';

/**
 * Process daily login streak for a user.
 * Returns { streak, points_awarded } to include in login response.
 * Points are written to point_transactions — the DB trigger syncs account_status.trust_points.
 */
async function processLoginStreak(userId) {
  // Use Philippine time (UTC+8) so "today" matches the user's actual calendar day
  const now = new Date();
  const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const today = phTime.toISOString().slice(0, 10);

  const { data: record, error: fetchError } = await supabaseAdmin
    .from('login_streaks')
    .select('streak_count, last_login_date, longest_streak')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('[STREAK] fetch error:', fetchError.message);
    return { streak: 0, points_awarded: 0 };
  }

  // Same day — no double award
  if (record?.last_login_date === today) {
    return { streak: record.streak_count, points_awarded: 0 };
  }

  let newStreak = 1;
  let pointsAwarded = 1;

  if (!record) {
    // First ever login — insert streak record
    const { error: insertError } = await supabaseAdmin.from('login_streaks').insert([{
      user_id: userId, streak_count: 1, last_login_date: today, longest_streak: 1,
    }]);
    if (insertError) {
      console.error('[STREAK] insert error:', insertError.message);
      return { streak: 0, points_awarded: 0 };
    }
  } else {
    // Existing record — calculate streak progression
    const daysDiff = Math.round(
      (new Date(today) - new Date(record.last_login_date)) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1)       newStreak = record.streak_count + 1;
    else if (daysDiff <= 3)   newStreak = record.streak_count; // 2-day grace period
    else                      newStreak = 1; // reset

    pointsAwarded = Math.min(newStreak, 5);
    const newLongest = Math.max(newStreak, record.longest_streak || 0);

    const { error: updateError } = await supabaseAdmin.from('login_streaks').update({
      streak_count: newStreak, last_login_date: today, longest_streak: newLongest,
    }).eq('user_id', userId);

    if (updateError) {
      console.error('[STREAK] update error:', updateError.message);
      return { streak: record.streak_count, points_awarded: 0 };
    }
  }

  // Award trust points — increment directly to avoid overwriting TP earned from other actions
  try {
    await supabaseAdmin.from('point_transactions').insert([{
      user_id: userId, amount: pointsAwarded, transaction_type: 'daily_recovery',
      reason: `Day ${newStreak} login streak`,
    }]);
  } catch {
    // point_transactions is optional — streak still counts without it
  }

  // Fetch current TP then increment — avoids overwriting TP earned from other actions
  const { data: current } = await supabaseAdmin.from('account_status').select('trust_points').eq('id', userId).single();
  await supabaseAdmin.from('account_status')
    .update({ trust_points: (current?.trust_points ?? 0) + pointsAwarded })
    .eq('id', userId);

  return { streak: newStreak, points_awarded: pointsAwarded };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { studentId, password } = req.body;

  const { data: account, error } = await supabaseAdmin
    .from('accounts')
    .select('*, account_status(*), account_details(*)')
    .eq('ctu_id', studentId)
    .single();

  if (error || !account) {
    return res.status(401).json({ message: 'CTU_ID not found in the system.' });
  }

  const status = account.account_status || {};
  const details = account.account_details || {};

  if (status.is_banned) {
    return res.status(403).json({ message: 'Your account has been banned.', banned: true });
  }

  if (status.suspended_until && new Date(status.suspended_until) > new Date()) {
    return res.status(403).json({
      message: `Your account is suspended until ${new Date(status.suspended_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
      suspended: true,
      suspended_until: status.suspended_until,
    });
  }

  const isPending = !status.is_verified;

  let authData;
  const { data: firstAuthData, error: authError } = await supabase.auth.signInWithPassword({
    email: account.email,
    password,
  });

  if (authError) {
    // Auto-confirm email if not confirmed — happens with new signups before email verification
    if (authError.message?.includes('Email not confirmed') || authError.message?.includes('email_not_confirmed')) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(account.id, { email_confirm: true });
        const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
          email: account.email, password,
        });
        if (retryError) return res.status(401).json({ message: 'Invalid credentials.' });
        authData = retryData;
      } catch {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
    } else {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
  } else {
    authData = firstAuthData;
  }

  // Process login streak — only for verified users
  let streakInfo = { streak: 0, points_awarded: 0 };
  if (!isPending) {
    try {
      streakInfo = await processLoginStreak(account.id);
    } catch (err) {
      console.error('[LOGIN] Streak processing error:', err.message);
    }
  }

  // Re-fetch trust_points after streak processing so the value is accurate
  const { data: freshStatus } = await supabaseAdmin
    .from('account_status')
    .select('trust_points')
    .eq('id', account.id)
    .single();

  const user = {
    ...account,
    student_id: account.ctu_id,
    is_verified: status.is_verified,
    is_banned: status.is_banned,
    suspended_until: status.suspended_until,
    warning_count: status.warning_count,
    trust_points: freshStatus?.trust_points ?? status.trust_points ?? 10,
    ...details,
  };
  delete user.account_status;
  delete user.account_details;

  res.json({
    message: isPending ? 'Pending approval' : 'Authentication successful',
    user,
    session: authData.session,
    pending: isPending,
    streak: streakInfo.streak,
    points_awarded: streakInfo.points_awarded,
  });
}
