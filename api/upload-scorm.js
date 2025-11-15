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

    // Calculate total upload size in MB (from rawBody)
    const uploadSizeMB = rawBody.length / (1024 * 1024);

    // Fetch current used storage and user plan quota
    const { data: usageData, error: usageError } = await supabase
      .from('usage_tracking')
      .select('total_storage_mb')
      .eq('user_id', user.id)
      .single();

    if (usageError && usageError.code !== 'PGRST116') {
      console.error('Supabase usage tracking error', usageError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const currentUsageMB = usageData ? Number(usageData.total_storage_mb) : 0;

    const { data: planData, error: planError } = await supabase
      .from('user_plans')
      .select('storage_limit_mb')
      .eq('user_id', user.id)
      .single();

    if (planError) {
      console.error('Supabase user plans error', planError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const quotaMB = planData ? Number(planData.storage_limit_mb) : 0;

    if (currentUsageMB + uploadSizeMB > quotaMB) {
      return res.status(400).json({
        error: `Upload exceeds your storage quota of ${quotaMB.toFixed(2)} MB. Please upgrade your plan.`,
      });
    }

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

    // Update storage usage in usage_tracking table
    const newUsageMB = currentUsageMB + uploadSizeMB;

    const { error: usageUpdateError } = await supabase
      .from('usage_tracking')
      .upsert(
        { user_id: user.id, total_storage_mb: newUsageMB },
        { onConflict: 'user_id' }
      );

    if (usageUpdateError) {
      console.error('Supabase usage update error', usageUpdateError);
      // Not critical - continue
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
