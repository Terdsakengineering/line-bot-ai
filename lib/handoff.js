const { getLineClient } = require('./lineClient');
const { HANDOFF_REPLY } = require('./constants');
const { log } = require('./log');

const HANDOFF_TRIGGERS = [
  'คุยกับคน',
  'ขอแอดมิน',
  'ขอเจ้าของ',
  'ขอคุยกับเจ้าหน้าที่',
  'ฟ้อง',
  'ร้องเรียน',
  'ไม่พอใจ',
  'ต่อว่า',
  'โกง',
  'หลอกลวง',
];

function shouldHandoff(message) {
  const lower = message.toLowerCase();
  return HANDOFF_TRIGGERS.some((trigger) => lower.includes(trigger));
}

async function notifyAdmin(userId, userMessage) {
  const adminGroupId = process.env.ADMIN_GROUP_ID;
  if (!adminGroupId) {
    log.warn('handoff.admin_group_not_set');
    return;
  }

  await getLineClient().pushMessage(adminGroupId, {
    type: 'text',
    text: `ลูกค้าต้องการคุยกับเจ้าหน้าที่\n\nUserID: ${userId}\nข้อความ: ${userMessage}`,
  });
}

module.exports = { shouldHandoff, notifyAdmin, HANDOFF_REPLY };
