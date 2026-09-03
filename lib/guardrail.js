// Keywords that must never be answered by Gemini directly — these need a
// human to check job-specific details (price, tolerance, lead time, minimum
// quantity) before anything is promised to the customer.
const BLOCKED_KEYWORDS = [
  'ราคา',
  'tolerance',
  'ค่าเผื่อ',
  'ความละเอียด',
  'วันส่งของ',
  'กำหนดส่ง',
  'สเปกเฉพาะเครื่อง',
  'จำนวนขั้นต่ำ',
  'ขั้นต่ำ',
];

const GUARDRAIL_REPLY =
  'เรื่องนี้ขอให้เจ้าหน้าที่ตรวจสอบข้อมูลก่อนตอบนะคะ กดปุ่ม "คุยกับเจ้าหน้าที่" ได้เลยค่ะ 🙏';

function isBlocked(message) {
  const lower = message.toLowerCase();
  return BLOCKED_KEYWORDS.some((keyword) => lower.includes(keyword));
}

module.exports = { isBlocked, GUARDRAIL_REPLY, BLOCKED_KEYWORDS };
