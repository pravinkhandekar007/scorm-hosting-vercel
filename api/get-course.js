import Cors from 'micro-cors';
import { createClient } from '@supabase/supabase-js';

const cors = Cors();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default cors(async (req, res) => {
  const { slug } = req.query;
  if (!slug) {
    return res.status(400).json({ error: 'Missing slug' });
  }

  try {
    const { data: course, error } = await supabase
      .from('courses')
      .select('course_slug, title, blob_path, launch_url')
      .eq('course_slug', slug)
      .single();

    if (error || !course) {
      return res.status(404).json({ error: 'Course Not Found' });
    }

    return res.status(200).json(course);
  } catch (err) {
    console.error('Get-course error', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
