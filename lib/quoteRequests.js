const { appendRow } = require('./sheetsClient');

const SHEET_TAB = process.env.SHEET_TAB_QUOTE_REQUESTS || 'Sheet1';
const RANGE = `${SHEET_TAB}!A:K`;

// Column order must match the sheet's header row:
// Timestamp, UserId, CustomerName, ContactPhone, Material, Processes,
// Quantity, DueDate, DrawingFileURL, Notes, Status
async function appendQuoteRequest(quote) {
  await appendRow(process.env.SHEET_ID_QUOTE_REQUESTS, RANGE, [
    new Date().toISOString(),
    quote.userId,
    quote.customerName || '',
    quote.contactPhone || '',
    quote.material || '',
    (quote.processes || []).join(', '),
    quote.quantity || '',
    quote.dueDate || '',
    quote.drawingFileUrl || '',
    quote.notes || '',
    'รอทีมงานตรวจสอบ',
  ]);
}

module.exports = { appendQuoteRequest };
