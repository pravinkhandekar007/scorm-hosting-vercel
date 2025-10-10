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
    let dataObj = req.body;
    if (!dataObj || !dataObj.courseId) {
      let bodyString = '';
      for await (const chunk of req) bodyString += chunk;
      dataObj = JSON.parse(bodyString);
    }

    console.log("Received courseId (should be slug):", dataObj.courseId);

    const courseId = dataObj.courseId;
    if (!courseId) {
      res.status(400).json({ error: 'Missing courseId in request body' });
      return;
    }

    const publicId = randomString(16);
    // The fix: match on course_slug, not id
    const { data, error } = await supabase
      .from('courses')
      .update({ public_id: publicId })
      .eq('course_slug', courseId)
      .select('public_id');

    console.log("Supabase update result:", { data, error });

    if (error) {
      console.log("Supabase error:", error);
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data || !data.length) {
      console.log("No course found with slug:", courseId);
      res.status(500).json({ error: 'Course not found or update failed' });
      return;
    }

    res.status(200).json({ publicId: data[0].public_id });
  } catch (err) {
    console.log("API error:", err);
    res.status(400).json({ error: 'Invalid request: ' + err.message });
  }
};
