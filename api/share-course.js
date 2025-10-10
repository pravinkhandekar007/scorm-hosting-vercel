const { createClient } = require('@supabase/supabase-js');
const { nanoid } = require('nanoid'); // Ensure nanoid is installed: npm install nanoid

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role ONLY in backend
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Parse request body for courseId
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { courseId } = JSON.parse(body);

      // 1. Generate a public_id
      const publicId = nanoid(16);

      // 2. Update course row where id matches
      const { data, error } = await supabase
        .from('courses')
        .update({ public_id: publicId })
        .eq('id', courseId)
        .select('public_id');

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ publicId: data[0].public_id });
    } catch (err) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });
};
