import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    // Handle preflight
    res.status(204).end();
    return;
  }

  const { path } = req.query;
  if (!path || typeof path !== 'string') {
    res.status(400).json({ error: 'Missing or invalid path parameter' });
    return;
  }

  try {
    // Download file from Supabase Storage bucket "scorm-packages"
    const { data, error } = await supabase.storage.from('scorm-packages').download(path);

    if (error || !data) {
      res.status(404).json({ error: 'File Not Found' });
      return;
    }

    // Determine content type based on file extension
    const ext = path.split('.').pop().toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Convert the ReadableStream to Buffer and send
    const arrayBuffer = await data.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Error serving SCORM file:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
