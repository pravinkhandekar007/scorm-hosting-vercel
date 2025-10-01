import Cors from 'micro-cors';
import { download } from '@vercel/blob';

const cors = Cors();
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
    bodyParser: false
  }
};

export default cors(async (req, res) => {
  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    // Download file from Vercel Blob
    const data = await download(path);
    if (!data) {
      return res.status(404).json({ error: 'File Not Found' });
    }

    // Determine content type
    const ext = path.split('.').pop().toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Security-Policy',
      "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src * data: blob:;"
    );
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Stream buffer
    const buffer = await data.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Serve error', err);
    res.status(500).json({ error: 'Failed to Serve File' });
  }
});
