import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, fullName, studentId, user_type, id_verified, id_photo_base64, id_photo_ext } = req.body;

  // Use signUp so Supabase sends the confirmation email
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.SITE_URL || 'https://project-nexo-react.vercel.app'}/portal`,
    },
  });

  if (authError) return res.status(400).json({ message: authError.message });
  if (!authData.user) return res.status(400).json({ message: 'Signup failed.' });

  // Upload ID photo via service role if provided
  let idPhotoUrl = null;
  if (id_photo_base64) {
    try {
      const ext = id_photo_ext || 'jpg';
      const path = `id-photos/${studentId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${ext}`;
      const buffer = Buffer.from(id_photo_base64, 'base64');
      const { error: uploadError } = await supabaseAdmin.storage
        .from('id-photos')
        .upload(path, buffer, { contentType: `image/${ext}`, upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage.from('id-photos').getPublicUrl(path);
        idPhotoUrl = urlData.publicUrl;
      }
    } catch {
      // photo upload failure is non-fatal
    }
  }

  // Insert profile linked to auth user
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert([{
      id: authData.user.id,
      student_id: studentId,
      full_name: fullName,
      email,
      user_type,
      is_verified: false,
      id_verified: id_verified || false,
      id_photo_url: idPhotoUrl,
    }])
    .select().single();

  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(400).json({ message: error.message });
  }

  res.status(200).json({
    message: 'Check your email to confirm your account.',
    user: data,
    session: null,
  });
}
