import { supabase, supabaseAdmin } from './_supabase.js';

/**
 * Process daily login streak for a user.
 * Returns { streak, points_awarded } to include in login response.
 * Points are written to point_transactions — the DB trigger syncs account_status.trust_points.
 */
async function processLoginStreak(userId, currentTrustPoints) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: record } = await supabaseAdmin
    .from('login_streaks')
    .select('streak_count, last_login_date, longest_streak')
    .eq('user_id', userId)
    .maybeSingle();

  // First ever login
  if (!record) {
    await supabaseAdmin.from('login_streaks').insert([{
      user_id: userId, streak_count: 1, last_login_date: today, longest_streak: 1,
    }]);
    await supabaseAdmin.from('point_transactions').insert([{
      user_id: userId, amount: 1, transaction_type: 'daily_recovery', reason: 'Day 1 login streak',
    }]);
    await supabaseAdmin.from('account_status')
      .update({ trust_points: (currentTrustPoints ?? 10) + 1 })
      .eq('id', userId);
    return { streak: 1, points_awarded: 1 };
  }

  // Same day — no double award
  if (record.last_login_date === today) {
    return { streak: record.streak_count, points_awarded: 0 };
  }

  const daysDiff = Math.round(
    (new Date(today) - new Date(record.last_login_date)) / (1000 * 60 * 60 * 24)
  );

  let newStreak;
  if (daysDiff === 1)      newStreak = record.streak_count + 1;
  else if (daysDiff <= 3)  newStreak = record.streak_count; // grace period
  else                     newStreak = 1; // reset

  const pointsAwarded = Math.min(newStreak, 5);
  const newLongest = Math.max(newStreak, record.longest_streak || 0);

  await supabaseAdmin.from('login_streaks').update({
    streak_count: newStreak, last_login_date: today, longest_streak: newLongest,
  }).eq('user_id', userId);

  await supabaseAdmin.from('point_transactions').insert([{
    user_id: userId, amount: pointsAwarded, transaction_type: 'daily_recovery',
    reason: `Day ${newStreak} login streak`,
  }]);

  // Directly update account_status — don't rely on DB trigger
  await supabaseAdmin.from('account_status')
    .update({ trust_points: (currentTrustPoints ?? 10) + pointsAwarded })
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

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: account.email,
    password,
  });

  if (authError) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  // Process login streak (non-blocking — don't fail login if this errors)
  let streakInfo = { streak: 0, points_awarded: 0 };
  try {
    streakInfo = await processLoginStreak(account.id, status.trust_points ?? 10);
  } catch (err) {
    console.error('[LOGIN] Streak processing error:', err.message);
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
