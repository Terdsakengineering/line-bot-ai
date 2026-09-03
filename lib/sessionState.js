const { readRange, appendRow, updateRow } = require('./sheetsClient');
const { log } = require('./log');

const SHEET_TAB = process.env.SHEET_TAB_SESSION_STATE || 'Sheet1';
// Columns: LineUserId, CurrentStep, TempDataJSON, LastUpdated
const RANGE = `${SHEET_TAB}!A:D`;

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

    const row = rows[index];
    const step = row[1];
    if (!step) return null;

    const data = row[2] ? JSON.parse(row[2]) : {};
    return { step, data };
  } catch (err) {
    log.error('sessionState.get_failed', { error: err.message });
    return null;
  }
}

async function setSession(userId, session) {
  const values = [userId, session.step, JSON.stringify(session.data || {}), new Date().toISOString()];

  const { index } = await findRow(userId);
  if (index === -1) {
    await appendRow(spreadsheetId(), RANGE, values);
  } else {
    await updateRow(spreadsheetId(), `${SHEET_TAB}!A${index + 1}:D${index + 1}`, values);
  }
}

async function clearSession(userId) {
  const { index } = await findRow(userId);
  if (index === -1) return;
  await updateRow(spreadsheetId(), `${SHEET_TAB}!A${index + 1}:D${index + 1}`, [
    userId,
    '',
    '',
    new Date().toISOString(),
  ]);
}

module.exports = { getSession, setSession, clearSession };
