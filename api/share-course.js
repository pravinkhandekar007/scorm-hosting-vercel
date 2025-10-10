const { createClient } = require('@supabase/supabase-js');
const { nanoid } = require('nanoid'); // Ensure nanoid is installed: npm install nanoid

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // Vercel/Netlify parse JSON body for you if content-type is application/json
    const { courseId } = req.body;

    if (!courseId) {
      res.status(400).json({ error: 'Missing courseId in request body' });
      return;
    }

    // If your primary key is 'course_slug', not 'id', update this line:
    const { data, error } = await supabase
      .from('courses')
      .update({ public_id: nanoid(16) })
      .eq('course_slug', courseId) // or .eq('id', courseId) if ID is used!
      .select('public_id');

    if (error || !data || data.length === 0) {
      res.status(500).json({ error: error?.message || 'Course not found' });
      return;
    }

    res.status(200).json({ publicId: data[0].public_id });
  } catch (err) {
    res.status(400).json({ error: 'Invalid request: ' + err.message });
  }
};
