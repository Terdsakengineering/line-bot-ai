const { buildPrompt } = require('./buildPrompt');
const { DEFAULT_REPLY } = require('./constants');
const { log } = require('./log');

const GEMINI_ATTEMPT_TIMEOUT_MS = 12000;
const GEMINI_MAX_ATTEMPTS = 2;
const GEMINI_RETRY_DELAY_MS = 500;
const MAX_OUTPUT_TOKENS = 1024; // headroom for thinking-capable models that count thinking + output together

// @google/genai ships ESM-only; requiring it via CommonJS resolves to an
// empty module on some runtimes, so it must be loaded with dynamic import().
let ai;
async function getClient() {
  if (!ai) {
    const { GoogleGenAI } = await import('@google/genai');
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

async function generateOnce(client, prompt) {
  return Promise.race([
    client.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: prompt,
      config: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('gemini_timeout')), GEMINI_ATTEMPT_TIMEOUT_MS)
    ),
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaExceeded(err) {
  const message = err && err.message;
  return Boolean(message) && (message.includes('429') || message.includes('RESOURCE_EXHAUSTED'));
}

async function askAssistant(userMessage) {
  const startTime = Date.now();
  const prompt = await buildPrompt(userMessage);
  const client = await getClient();

  let lastError;
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await generateOnce(client, prompt);

      const finishReason = response.candidates && response.candidates[0] && response.candidates[0].finishReason;
      if (finishReason === 'MAX_TOKENS') {
        log.warn('gemini.truncated', { latencyMs: Date.now() - startTime, attempt });
        return DEFAULT_REPLY;
      }

      const text = response.text ? response.text.trim() : '';
      log.info('gemini.reply', {
        latencyMs: Date.now() - startTime,
        outputLength: text.length,
        finishReason,
        attempt,
      });
      return text || DEFAULT_REPLY;
    } catch (err) {
      lastError = err;
      log.warn('gemini.attempt_failed', { latencyMs: Date.now() - startTime, attempt, error: err.message });

      // A quota error will fail identically on retry (Google's own
      // retryDelay is usually tens of seconds, far past our budget), so
      // don't waste a second request on it — fail fast instead.
      if (isQuotaExceeded(err)) {
        break;
      }
      if (attempt < GEMINI_MAX_ATTEMPTS) {
        await sleep(GEMINI_RETRY_DELAY_MS);
      }
    }
  }

  log.error('gemini.failed', { latencyMs: Date.now() - startTime, error: lastError && lastError.message });
  return DEFAULT_REPLY;
}

module.exports = { askAssistant, DEFAULT_REPLY };
