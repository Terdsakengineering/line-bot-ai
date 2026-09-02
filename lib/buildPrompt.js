const { PROMPT_TEMPLATE } = require('./promptTemplate');
const { loadFaqCsv } = require('./faqSource');

async function buildPrompt(userMessage) {
  const faqCsv = await loadFaqCsv();
  return PROMPT_TEMPLATE
    .replace('{{FAQ_CSV}}', faqCsv)
    .replace('{{USER_MESSAGE}}', userMessage);
}

module.exports = { buildPrompt };
