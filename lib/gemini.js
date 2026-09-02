const { GoogleGenAI } = require('@google/genai');
const { buildPrompt } = require('./buildPrompt');

const FALLBACK_REPLY =
  'เรื่องนี้ขอให้เจ้าหน้าที่ช่วยตอบให้ละเอียดอีกทีนะคะ รบกวนแจ้งเบอร์โทรไว้ได้ไหมคะ ทางทีมงานจะติดต่อกลับให้เร็วที่สุดค่ะ';

let ai;
function getClient() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

async function askAssistant(userMessage) {
  const prompt = buildPrompt(userMessage);

  try {
    const response = await getClient().models.generateContent({
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
