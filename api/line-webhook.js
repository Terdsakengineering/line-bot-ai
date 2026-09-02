const { validateSignature } = require('@line/bot-sdk');
const { getRawBody } = require('../lib/getRawBody');
const { getLineClient, lineConfig } = require('../lib/lineClient');
const { askAssistant, DEFAULT_REPLY } = require('../lib/gemini');
const { shouldHandoff, notifyAdmin, HANDOFF_REPLY } = require('../lib/handoff');
const { log } = require('../lib/log');

const REPLY_RETRY_ATTEMPTS = 3;

async function replyWithRetry(replyToken, text, attempts) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await getLineClient().replyMessage(replyToken, { type: 'text', text });
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
    }
  }
}

function logGroupSourceId(event) {
  // Convenience for finding a group/room ADMIN_TARGET_ID later: log the
  // source id whenever the bot sees an event from a group/room so the
  // owner can read it from Vercel logs instead of writing a separate
  // script. For a 1:1 admin chat, the userId already appears in the
  // reply.sent / handoff.routed logs below.
  const source = event.source || {};
  if (source.type === 'group') {
    log.info('source.group_seen', { groupId: source.groupId });
  } else if (source.type === 'room') {
    log.info('source.room_seen', { roomId: source.roomId });
  }
}

async function handleEvent(event) {
  logGroupSourceId(event);

  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const userId = (event.source && event.source.userId) || 'unknown';
  const startTime = Date.now();

  try {
    if (shouldHandoff(event.message.text)) {
      await notifyAdmin(userId, event.message.text);
      await replyWithRetry(event.replyToken, HANDOFF_REPLY, REPLY_RETRY_ATTEMPTS);
      log.info('handoff.routed', { userId, latencyMs: Date.now() - startTime });
      return;
    }

    const replyText = await askAssistant(event.message.text);
    await replyWithRetry(event.replyToken, replyText, REPLY_RETRY_ATTEMPTS);
    log.info('reply.sent', {
      userId,
      latencyMs: Date.now() - startTime,
      replyLength: replyText.length,
    });
  } catch (err) {
    log.error('webhook.event_failed', { userId, error: err.message });
    try {
      await getLineClient().replyMessage(event.replyToken, { type: 'text', text: DEFAULT_REPLY });
    } catch {
      // replyToken may have already expired — nothing more we can do.
    }
  }
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
    log.error('webhook.signature_check_error', { error: err.message });
  }

  if (!signatureValid) {
    log.warn('webhook.invalid_signature');
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

  // Each event already handles its own errors and best-effort fallback reply,
  // so we always acknowledge with 200 to avoid LINE retrying (and double-replying).
  await Promise.all((body.events || []).map(handleEvent));
  res.status(200).json({ ok: true });
}

// Disable Vercel's automatic body parsing so we can verify the raw
// request body against LINE's x-line-signature header.
handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;
