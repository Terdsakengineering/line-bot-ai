const { buildPrompt } = require('./buildPrompt');

const FALLBACK_REPLY =
  'เรื่องนี้ขอให้เจ้าหน้าที่ช่วยตอบให้ละเอียดอีกทีนะคะ รบกวนแจ้งเบอร์โทรไว้ได้ไหมคะ ทางทีมงานจะติดต่อกลับให้เร็วที่สุดค่ะ';

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
  const prompt = await buildPrompt(userMessage);

  try {
    const client = await getClient();
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text ? response.text.trim() : '';
    return text || FALLBACK_REPLY;
  } catch (err) {
    console.error('Gemini request failed:', err);
    return FALLBACK_REPLY;
  }
}

module.exports = { askAssistant, FALLBACK_REPLY };
