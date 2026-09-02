const { PROMPT_TEMPLATE } = require('./promptTemplate');
const { loadFaqCsv } = require('./faqSource');
const { DEFAULT_REPLY } = require('./constants');

async function buildPrompt(userMessage) {
  const faqCsv = await loadFaqCsv();
  return PROMPT_TEMPLATE
    .replace('{{FAQ_CSV}}', faqCsv)
    .replace('{{USER_MESSAGE}}', userMessage)
    .replace('{{DEFAULT_REPLY}}', DEFAULT_REPLY);
}

module.exports = { buildPrompt };
