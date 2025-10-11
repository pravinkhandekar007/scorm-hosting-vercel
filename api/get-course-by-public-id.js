const { createClient } = require('@supabase/supabase-js');

// Use the Supabase ANON key for all public requests
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  // Read public_id from query for GET, or body for POST
  let public_id = req.query.public_id;
  if (!public_id && req.body) {
    try {
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
      public_id = body.public_id;
    } catch {
      // Ignore JSON parse errors if body is not present or not valid JSON
    }
  }

  if (!public_id) {
    res.status(400).json({ error: 'Missing public_id parameter.' });
    return;
  }

  // Only select publicly safe metadata fields
  const { data, error } = await supabase
    .from('courses')
    .select('course_slug, package_path, launch_url, title, public_id, expires_at')
    .eq('public_id', public_id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: error?.message || 'Course not found for public_id.' });
    return;
  }

  res.status(200).json(data);
};
