const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function randomString(len = 16) {
  return Array(len).fill(0).map(() => Math.random().toString(36)[2] || 'x').join('');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    let bodyObj = req.body;
    if (!bodyObj || !bodyObj.courseId) {
      // Fallback for body parsing in cloud
      let raw = '';
      for await (const chunk of req) raw += chunk;
      bodyObj = JSON.parse(raw);
    }

    console.log("Received courseId:", bodyObj.courseId);

    const courseId = bodyObj.courseId;
    if (!courseId) {
      res.status(400).json({ error: 'Missing courseId in request body' });
      return;
    }

    const publicId = randomString(16);

    // Use 'id' to match the UUID column in your table
    const { data, error } = await supabase
      .from('courses')
      .update({ public_id: publicId })
      .eq('id', courseId)
      .select('public_id');

    console.log("Supabase update response:", { data, error });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data || !data.length) {
      res.status(500).json({ error: 'Course not found or update failed' });
      return;
    }

    res.status(200).json({ publicId: data[0].public_id });
  } catch (err) {
    console.log("API error:", err);
    res.status(400).json({ error: 'Invalid request: ' + err.message });
  }
};
