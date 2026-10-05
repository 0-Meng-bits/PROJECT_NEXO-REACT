import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  // PATCH — edit a message
  if (req.method === 'PATCH') {
    const { id, content } = req.body;
    if (!id || !content) return res.status(400).json({ message: 'Missing id or content' });

    const { error } = await supabaseAdmin
      .from('messages')
      .update({ content, edited: true })
      .eq('id', id);

    if (error) return res.status(400).json({ message: error.message });
    return res.status(200).json({ success: true });
  }

  // DELETE — delete a message
  if (req.method === 'DELETE') {
    const id = req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ message: 'Missing id' });

    const { error } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ message: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
