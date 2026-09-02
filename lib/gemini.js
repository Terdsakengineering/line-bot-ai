const { buildPrompt } = require('./buildPrompt');
const { DEFAULT_REPLY } = require('./constants');
const { log } = require('./log');

const GEMINI_TIMEOUT_MS = 8000;
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

async function askAssistant(userMessage) {
  const startTime = Date.now();
  const prompt = await buildPrompt(userMessage);

  try {
    const client = await getClient();

    const response = await Promise.race([
      client.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        contents: prompt,
        config: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('gemini_timeout')), GEMINI_TIMEOUT_MS)
      ),
    ]);

    const finishReason = response.candidates && response.candidates[0] && response.candidates[0].finishReason;
    if (finishReason === 'MAX_TOKENS') {
      log.warn('gemini.truncated', { latencyMs: Date.now() - startTime });
      return DEFAULT_REPLY;
    }

    const text = response.text ? response.text.trim() : '';
    log.info('gemini.reply', {
      latencyMs: Date.now() - startTime,
      outputLength: text.length,
      finishReason,
    });
    return text || DEFAULT_REPLY;
  } catch (err) {
    log.error('gemini.failed', { latencyMs: Date.now() - startTime, error: err.message });
    return DEFAULT_REPLY;
  }
}

module.exports = { askAssistant, DEFAULT_REPLY };
