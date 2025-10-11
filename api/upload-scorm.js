import { buffer } from 'micro';
import Cors from 'micro-cors';
import JSZip from 'jszip';
import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

const cors = Cors();

// Initialize Supabase client for metadata
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export const config = {
  api: {
    bodyParser: false
  }
};

export default cors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Authenticate user via Supabase Auth
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Read raw multipart body
    const rawBody = await buffer(req);
    // Use JSZip to unzip buffer
    const zip = await JSZip.loadAsync(rawBody);
    const courseSlug = `course-${Date.now()}-${crypto.randomUUID()}`;
    const blobBasePath = `${user.id}/${courseSlug}`;

    // Unzip and upload each file
    const uploadPromises = [];
    zip.forEach((relativePath, file) => {
      if (!file.dir) {
        uploadPromises.push(
          file.async('arraybuffer').then(content =>
            put(`${blobBasePath}/${relativePath}`, content, {
              access: 'public',
              addRandomSuffix: false
            })
          )
        );
      }
    });
    await Promise.all(uploadPromises);

    // Insert metadata into Supabase
    const { data: course, error: dbError } = await supabase
      .from('courses')
      .insert({
        user_id: user.id,
        course_slug: courseSlug,
        title: req.headers['x-course-title'] || courseSlug,
        blob_path: blobBasePath,
        launch_url: 'index.html'
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB insert error', dbError);
      return res.status(500).json({ error: 'Database Error' });
    }

    return res.status(200).json({
      success: true,
      course_slug: course.course_slug,
      player_url: `/player.html?course=${course.course_slug}`
    });
  } catch (err) {
    console.error('Upload error', err);
    return res.status(500).json({ error: 'Upload Failed' });
  }
});
