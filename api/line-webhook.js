const { validateSignature } = require('@line/bot-sdk');
const { getRawBody } = require('../lib/getRawBody');
const { getLineClient, lineConfig } = require('../lib/lineClient');
const { askAssistant } = require('../lib/gemini');

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const replyText = await askAssistant(event.message.text);

  return getLineClient().replyMessage(event.replyToken, {
    type: 'text',
    text: replyText,
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).send('OK');
    return;
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'];

  let signatureValid = false;
  try {
    signatureValid = Boolean(signature) && validateSignature(rawBody, lineConfig.channelSecret, signature);
  } catch (err) {
    console.error('Signature validation failed (check LINE_CHANNEL_SECRET):', err);
  }

  if (!signatureValid) {
    res.status(401).send('Invalid signature');
    return;
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    res.status(400).send('Invalid body');
    return;
  }

  try {
    await Promise.all((body.events || []).map(handleEvent));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook handling failed:', err);
    res.status(500).json({ ok: false });
  }
}

// Disable Vercel's automatic body parsing so we can verify the raw
// request body against LINE's x-line-signature header.
handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;
