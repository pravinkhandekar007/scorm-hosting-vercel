import { createClient } from '@supabase/supabase-js';

// Use ANON key for public access to storage
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MIME_TYPES = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  ico: 'image/x-icon',
  txt: 'text/plain'
};

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const { path } = req.query;
  if (!path || typeof path !== 'string') {
    res.status(400).json({ error: 'Missing or invalid path parameter' });
    return;
  }

  try {
    const { data, error } = await supabase.storage.from('scorm-packages').download(path);

    if (error || !data) {
      console.error('[serve-scorm] Download error:', { path, error });
      res.status(404).json({
        error: 'File Not Found',
        details: error ? error.message : 'Supabase returned no data',
        path
      });
      return;
    }

    // Content type
    const ext = path.split('.').pop().toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const buf = Buffer.from(await data.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error('[serve-scorm] Exception:', { path, error: err.message });
    res.status(500).json({
      error: 'Failed to Serve File',
      details: err.message,
      path
    });
  }
}
