const { google } = require('googleapis');

let sheetsApi;
function getSheetsApi() {
  if (!sheetsApi) {
    const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsApi = google.sheets({ version: 'v4', auth });
  }
  return sheetsApi;
}

async function readRange(spreadsheetId, range) {
  const sheets = getSheetsApi();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

async function appendRow(spreadsheetId, range, values) {
  const sheets = getSheetsApi();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

async function updateRow(spreadsheetId, range, values) {
  const sheets = getSheetsApi();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

module.exports = { readRange, appendRow, updateRow };
