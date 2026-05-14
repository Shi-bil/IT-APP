import 'dotenv/config';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  const key = process.env.VAPID_PUBLIC_KEY || '';
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ publicKey: key }));
}
