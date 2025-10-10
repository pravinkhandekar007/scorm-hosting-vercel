const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  const { public_id } = req.query;
  if (!public_id) {
    res.status(400).json({ error: 'Missing public_id parameter' });
    return;
  }
  const { data, error } = await supabase
    .from('courses')
    .select('public_id, package_path, launch_url, title')
    .eq('public_id', public_id)
    .single();
  if (error || !data) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  res.status(200).json(data);
};
