const fs = require('fs');
const path = require('path');

const LOCAL_FAQ_PATH = path.join(__dirname, '..', 'data', 'faq.csv');
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = { csv: null, fetchedAt: 0 };

function loadLocalFaqCsv() {
  return fs.readFileSync(LOCAL_FAQ_PATH, 'utf8');
}

async function loadFaqCsv() {
  const sheetUrl = process.env.SHEET_CSV_URL;
  if (!sheetUrl) {
    return loadLocalFaqCsv();
  }

  const isFresh = cache.csv && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) {
    return cache.csv;
  }

  try {
    const response = await fetch(sheetUrl);
    if (!response.ok) {
      throw new Error(`Sheet responded with status ${response.status}`);
    }

    const csv = await response.text();
    const looksLikeHtml = csv.trim().slice(0, 100).toLowerCase().includes('<html');
    if (looksLikeHtml) {
      throw new Error(
        'Sheet returned an HTML page instead of CSV — check that the sheet is shared as "Anyone with the link" or published to the web'
      );
    }

    console.log('Loaded FAQ sheet, preview:', csv.slice(0, 120).replace(/\n/g, ' | '));
    cache = { csv, fetchedAt: Date.now() };
    return csv;
  } catch (err) {
    console.error('Failed to fetch FAQ sheet, falling back to local faq.csv:', err);
    return cache.csv || loadLocalFaqCsv();
  }
}

module.exports = { loadFaqCsv };
