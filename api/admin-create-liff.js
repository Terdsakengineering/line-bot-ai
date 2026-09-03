// Temporary one-off endpoint to create the LIFF app via LINE's LIFF Server
// API instead of clicking through the Developers Console. Delete this file
// right after use — it's not meant to stay in the deployed app.

async function handler(req, res) {
  if (req.query.token !== process.env.TEMP_ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const origin = `https://${req.headers.host}`;

  const response = await fetch('https://api.line.me/liff/v1/apps', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      view: { type: 'tall', url: `${origin}/liff/processes.html` },
      description: 'เลือกกระบวนการ',
    }),
  });

  const data = await response.json();
  res.status(response.status).json(data);
}

module.exports = handler;
