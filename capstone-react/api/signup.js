import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, fullName, studentId, user_type, gender, id_verified, id_photo_base64, id_photo_ext, selfie_base64, selfie_ext } = req.body;

  // Validate gender
  const VALID_GENDERS = ['Male', 'Female', 'Prefer not to say'];
  if (!VALID_GENDERS.includes(gender)) {
    return res.status(400).json({ message: 'Invalid gender value.' });
  }

  // Check for duplicate CTU ID or active email before creating auth user
  const { data: existingAccount } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('ctu_id', studentId)
    .maybeSingle();
  if (existingAccount) {
    return res.status(400).json({ message: 'This CTU ID is already registered.' });
  }

  const { data: existingEmailAcc } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (existingEmailAcc) {
    return res.status(400).json({ message: 'This email is already registered.' });
  }

  // Create user with email already confirmed via 6-digit OTP
  let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  // If Auth says email exists even though accounts has no row, clean up the orphaned auth user and retry
  if (authError && /already|exists/i.test(authError.message || '')) {
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const orphan = (listData?.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (orphan) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(orphan.id);
      if (delErr) {
        await supabaseAdmin.auth.admin.updateUserById(orphan.id, { email: `deleted_${orphan.id}@deleted.local` }).catch(() => {});
      }
      const retry = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      authData = retry.data;
      authError = retry.error;
    }
  }

  if (authError) return res.status(400).json({ message: authError.message });
  if (!authData?.user) return res.status(400).json({ message: 'Signup failed.' });

  // Upload ID photo and live selfie via service role if provided
  const uploadVerificationImage = async (base64, ext, folder) => {
    if (!base64) return null;
    try {
      const safeExt = ext || 'jpg';
      const path = `${folder}/${studentId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${safeExt}`;
      const buffer = Buffer.from(base64, 'base64');
      const { error: uploadError } = await supabaseAdmin.storage
        .from('id-photos')
        .upload(path, buffer, { contentType: `image/${safeExt}`, upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage.from('id-photos').getPublicUrl(path);
        return urlData.publicUrl;
      }
    } catch {
      // photo upload failure is non-fatal
    }
    return null;
  };

  const [idPhotoUrl, selfieUrl] = await Promise.all([
    uploadVerificationImage(id_photo_base64, id_photo_ext, 'id-photos'),
    uploadVerificationImage(selfie_base64, selfie_ext, 'selfie-photos'),
  ]);

  try {
    await supabaseAdmin.from('accounts').insert([{
      id: authData.user.id, ctu_id: studentId, full_name: fullName, email, user_type,
    }]);
    await supabaseAdmin.from('account_status').insert([{ id: authData.user.id, is_verified: false }]);
    await supabaseAdmin.from('account_details').insert([{ id: authData.user.id, id_photo_url: idPhotoUrl, selfie_url: selfieUrl, gender }]);
  } catch (e) {
    console.warn('[SIGNUP] New table insert warning:', e.message);
  }

  res.status(200).json({
    message: 'Account created! Your account is now pending admin approval.',
    user: { id: authData.user.id, ctu_id: studentId, full_name: fullName, email, user_type },
    session: null,
  });
}
