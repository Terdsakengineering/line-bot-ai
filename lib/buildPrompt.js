const fs = require('fs');
const path = require('path');
const { PROMPT_TEMPLATE } = require('./promptTemplate');

const FAQ_PATH = path.join(__dirname, '..', 'data', 'faq.csv');

function loadFaqCsv() {
  return fs.readFileSync(FAQ_PATH, 'utf8');
}

function buildPrompt(userMessage) {
  const faqCsv = loadFaqCsv();
  return PROMPT_TEMPLATE
    .replace('{{FAQ_CSV}}', faqCsv)
    .replace('{{USER_MESSAGE}}', userMessage);
}

module.exports = { buildPrompt };
