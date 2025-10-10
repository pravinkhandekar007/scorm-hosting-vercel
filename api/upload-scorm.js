import { buffer } from 'micro';
import Cors from 'micro-cors';
import JSZip from 'jszip';
import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

const cors = Cors();

// Initialize Supabase client for metadata
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for backend operations
);

// Generate random public ID
function generatePublicId(len = 16) {
  return Array(len).fill(0).map(() => Math.random().toString(36)[2] || 'x').join('');
}

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
    
    // Create a client with anon key for auth verification
    const anonSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse query parameters
    const { course, retention_days, courseTitle } = req.query;
    
    // Read raw multipart body
    const rawBody = await buffer(req);
    
    // Use JSZip to unzip buffer
    const zip = await JSZip.loadAsync(rawBody);
    const courseSlug = course || `course-${Date.now()}-${generatePublicId(8)}`;
    const blobBasePath = `${user.id}/${courseSlug}`;

    console.log(`Processing upload for user: ${user.id}, course: ${courseSlug}`);

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

    console.log(`Files uploaded for course: ${courseSlug}`);

    // Generate public ID for sharing
    const publicId = generatePublicId(16);

    // Insert metadata into Supabase with public_id
    const { data: course_data, error: dbError } = await supabase
      .from('courses')
      .insert({
        user_id: user.id,
        course_slug: courseSlug,
        title: decodeURIComponent(courseTitle) || courseSlug,
        package_path: courseSlug,
        launch_url: 'index.html',
        public_id: publicId,
        expires_at: retention_days ? 
          new Date(Date.now() + parseFloat(retention_days) * 24 * 60 * 60 * 1000).toISOString() : 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Default 30 days
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB insert error:', dbError);
      return res.status(500).json({ error: 'Database Error: ' + dbError.message });
    }

    console.log(`Course metadata saved: ${courseSlug}, public_id: ${publicId}`);

    return res.status(200).json({
      success: true,
      course_slug: course_data.course_slug,
      public_id: course_data.public_id,
      player_url: `/player.html?course=${course_data.course_slug}`,
      public_url: `/player.html?public_id=${course_data.public_id}`
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload Failed: ' + err.message });
  }
});
