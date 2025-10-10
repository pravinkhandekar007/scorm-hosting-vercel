const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Pure JS random string generator (no npm install required)
function randomString(len = 16) {
  return Array(len).fill(0).map(() => Math.random().toString(36)[2] || 'x').join('');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // Universal body parsing (works for both cloud and local)
    let bodyObj = req.body;
    if (!bodyObj || !bodyObj.courseId) {
      let bodyString = '';
      for await (const chunk of req) bodyString += chunk;
      bodyObj = JSON.parse(bodyString);
    }

    const courseId = bodyObj.courseId;
    if (!courseId) {
      res.status(400).json({ error: 'Missing courseId in request body' });
      return;
    }

    const publicId = randomString(16);

    // Use .eq('course_slug', ...) or .eq('id', ...) depending on your database
    const { data, error } = await supabase
      .from('courses')
      .update({ public_id: publicId })
      .eq('course_slug', courseId) // or .eq('id', courseId) if you use ID
      .select('public_id');

    if (error || !data || !data.length) {
      res.status(500).json({ error: error?.message || 'Course not found' });
      return;
    }

    res.status(200).json({ publicId: data[0].public_id });
  } catch (err) {
    res.status(400).json({ error: 'Invalid request: ' + err.message });
  }
};
