const { readRange, appendRow, updateRow } = require('./sheetsClient');
const { log } = require('./log');

const SHEET_TAB = process.env.SHEET_TAB_SESSION_STATE || 'Sheet1';
const RANGE = `${SHEET_TAB}!A:C`;

function spreadsheetId() {
  return process.env.SHEET_ID_SESSION_STATE;
}

async function findRow(userId) {
  const rows = await readRange(spreadsheetId(), RANGE);
  const index = rows.findIndex((row) => row[0] === userId);
  return { index, rows };
}

async function getSession(userId) {
  try {
    const { index, rows } = await findRow(userId);
    if (index === -1) return null;

    const stateJson = rows[index][1];
    if (!stateJson) return null;

    return JSON.parse(stateJson);
  } catch (err) {
    log.error('sessionState.get_failed', { error: err.message });
    return null;
  }
}

async function setSession(userId, state) {
  const stateJson = JSON.stringify(state);
  const updatedAt = new Date().toISOString();

  const { index } = await findRow(userId);
  if (index === -1) {
    await appendRow(spreadsheetId(), RANGE, [userId, stateJson, updatedAt]);
  } else {
    await updateRow(spreadsheetId(), `${SHEET_TAB}!A${index + 1}:C${index + 1}`, [userId, stateJson, updatedAt]);
  }
}

async function clearSession(userId) {
  const { index } = await findRow(userId);
  if (index === -1) return;
  await updateRow(spreadsheetId(), `${SHEET_TAB}!A${index + 1}:C${index + 1}`, [userId, '', new Date().toISOString()]);
}

module.exports = { getSession, setSession, clearSession };
