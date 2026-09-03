const { appendQuoteRequest } = require('./quoteRequests');
const { notifyAdmin } = require('./handoff');

const START_QUOTE_TRIGGERS = ['ส่งแบบขอใบเสนอราคา', 'ขอใบเสนอราคา'];
const FAQ_MENU_TRIGGERS = ['ข้อมูลเครื่องจักร/บริการ', 'ข้อมูลเครื่องจักร', 'ข้อมูลบริการ'];
const STAFF_MENU_TRIGGERS = ['คุยกับเจ้าหน้าที่', 'เร่งสถานะงาน'];

// Keep in sync with PROCESS_OPTIONS in public/liff/processes.html.
const PROCESS_OPTIONS = ['กัด (Milling)', 'กลึง (Turning)', 'เจียร (Grinding)', 'เจาะ Gun Drill'];

const CANCEL_QUICK_REPLY_ITEM = {
  type: 'action',
  action: { type: 'message', label: 'คุยกับเจ้าหน้าที่', text: 'คุยกับเจ้าหน้าที่' },
};

const DONE_SENDING_FILES_TRIGGER = 'ส่งครบแล้ว';

function textMessage(text, quickReplyItems) {
  const message = { type: 'text', text };
  if (quickReplyItems && quickReplyItems.length) {
    message.quickReply = { items: quickReplyItems };
  }
  return message;
}

function quickReplyItem(label, text) {
  return { type: 'action', action: { type: 'message', label, text } };
}

function isStartQuoteTrigger(text) {
  return START_QUOTE_TRIGGERS.includes(text.trim());
}

function isStaffMenuTrigger(text) {
  return STAFF_MENU_TRIGGERS.includes(text.trim());
}

function isFaqMenuTrigger(text) {
  return FAQ_MENU_TRIGGERS.includes(text.trim());
}

async function routeToStaff(userId, messageText) {
  await notifyAdmin(userId, messageText);
  return {
    replyMessages: [textMessage('รับเรื่องแล้วนะคะ เดี๋ยวเจ้าหน้าที่ติดต่อกลับไปเร็วๆ นี้ค่ะ 🙏')],
    nextSession: null,
  };
}

function startQuoteFlow() {
  return {
    replyMessages: [
      textMessage(
        'เริ่มขอใบเสนอราคากันเลยค่ะ มีทั้งหมด 5 ขั้นตอนง่ายๆ นะคะ\n1) ไฟล์แบบงาน 2) วัสดุ 3) กระบวนการที่ต้องการ 4) จำนวน+กำหนดส่ง 5) ข้อมูลติดต่อ'
      ),
      textMessage(
        'ขั้นตอนที่ 1: รบกวนส่งไฟล์แบบงานมาได้เลยค่ะ (รูปภาพหรือไฟล์ ส่งได้มากกว่า 1 ไฟล์) ถ้ายังไม่มีไฟล์ พิมพ์อธิบายลักษณะงานมาแทนได้ค่ะ ส่งครบแล้วกดปุ่ม "ส่งครบแล้ว" ได้เลยค่ะ',
        [quickReplyItem(DONE_SENDING_FILES_TRIGGER, DONE_SENDING_FILES_TRIGGER), CANCEL_QUICK_REPLY_ITEM]
      ),
    ],
    nextSession: { step: 'AWAIT_DRAWING', data: {} },
  };
}

function askDrawingMore(data) {
  const fileCount = (data.drawingFileUrls || []).length;
  const ack = fileCount ? `รับไฟล์แล้ว ${fileCount} ไฟล์ค่ะ ` : 'รับข้อมูลแล้วค่ะ ';
  return {
    replyMessages: [
      textMessage(`${ack}ส่งเพิ่มได้อีกถ้ามี หรือกด "${DONE_SENDING_FILES_TRIGGER}" เพื่อไปขั้นตอนถัดไปค่ะ`, [
        quickReplyItem(DONE_SENDING_FILES_TRIGGER, DONE_SENDING_FILES_TRIGGER),
        CANCEL_QUICK_REPLY_ITEM,
      ]),
    ],
    nextSession: { step: 'AWAIT_DRAWING', data },
  };
}

function askMaterial(data) {
  return {
    replyMessages: [
      textMessage('ขั้นตอนที่ 2: วัสดุที่ใช้ทำงานนี้เป็นแบบไหนคะ', [
        quickReplyItem('ลูกค้าจัดหาเอง', 'วัสดุ: ลูกค้าจัดหาเอง'),
        quickReplyItem('ให้ TSE จัดหา', 'วัสดุ: ให้ TSE จัดหา'),
        quickReplyItem('ไม่แน่ใจ', 'วัสดุ: ไม่แน่ใจ'),
        CANCEL_QUICK_REPLY_ITEM,
      ]),
    ],
    nextSession: { step: 'AWAIT_MATERIAL', data },
  };
}

function askProcesses(data) {
  const chosen = data.processes || [];
  const liffUrl = process.env.LIFF_PROCESSES_URL;

  if (liffUrl) {
    return {
      replyMessages: [
        textMessage('ขั้นตอนที่ 3: กดปุ่มด้านล่างเพื่อเลือกกระบวนการที่ต้องการ (เลือกได้หลายอัน)', [
          { type: 'action', action: { type: 'uri', label: 'เลือกกระบวนการ', uri: liffUrl } },
          CANCEL_QUICK_REPLY_ITEM,
        ]),
      ],
      nextSession: { step: 'AWAIT_PROCESSES', data },
    };
  }

  // Fallback when LIFF_PROCESSES_URL isn't configured: tap one at a time.
  const options = PROCESS_OPTIONS.filter((p) => !chosen.includes(p));
  const items = options.map((p) => quickReplyItem(p, p));
  items.push(quickReplyItem('เสร็จแล้ว', 'เสร็จแล้ว'));
  items.push(CANCEL_QUICK_REPLY_ITEM);

  const chosenText = chosen.length ? `เลือกไว้แล้ว: ${chosen.join(', ')}\n` : '';
  return {
    replyMessages: [
      textMessage(
        `ขั้นตอนที่ 3: ต้องการกระบวนการไหนบ้างคะ (เลือกได้หลายอัน แตะทีละอัน แล้วกด "เสร็จแล้ว" เมื่อเลือกครบ)\n${chosenText}`,
        items
      ),
    ],
    nextSession: { step: 'AWAIT_PROCESSES', data },
  };
}

function askQuantity(data) {
  return {
    replyMessages: [textMessage('ขั้นตอนที่ 4: ต้องการจำนวนกี่ชิ้นคะ', [CANCEL_QUICK_REPLY_ITEM])],
    nextSession: { step: 'AWAIT_QUANTITY', data },
  };
}

function askDueDate(data) {
  return {
    replyMessages: [textMessage('ต้องการรับงานวันไหนคะ (กำหนดส่ง)', [CANCEL_QUICK_REPLY_ITEM])],
    nextSession: { step: 'AWAIT_DUE_DATE', data },
  };
}

function askCustomerName(data) {
  return {
    replyMessages: [textMessage('ขั้นตอนที่ 5: ชื่อบริษัทหรือชื่อผู้ติดต่อคะ', [CANCEL_QUICK_REPLY_ITEM])],
    nextSession: { step: 'AWAIT_CUSTOMER_NAME', data },
  };
}

function askContactPhone(data) {
  return {
    replyMessages: [textMessage('ขอเบอร์ติดต่อกลับด้วยค่ะ', [CANCEL_QUICK_REPLY_ITEM])],
    nextSession: { step: 'AWAIT_CONTACT_PHONE', data },
  };
}

function summaryText(data) {
  const files = data.drawingFileUrls || [];
  const fileText = files.length ? `${files.length} ไฟล์` : '';
  const drawingSummary = [fileText, data.notes].filter(Boolean).join(' + ') || '-';
  return [
    'สรุปข้อมูลใบเสนอราคาค่ะ',
    `ไฟล์/รายละเอียดงาน: ${drawingSummary}`,
    `วัสดุ: ${data.material || '-'}`,
    `กระบวนการ: ${(data.processes || []).join(', ') || '-'}`,
    `จำนวน: ${data.quantity || '-'}`,
    `กำหนดส่ง: ${data.dueDate || '-'}`,
    `ชื่อผู้ติดต่อ: ${data.customerName || '-'}`,
    `เบอร์ติดต่อ: ${data.contactPhone || '-'}`,
  ].join('\n');
}

function askConfirm(data) {
  return {
    replyMessages: [
      textMessage(summaryText(data), [
        quickReplyItem('ยืนยันส่งข้อมูล', 'ยืนยันส่งข้อมูล'),
        quickReplyItem('แก้ไขข้อมูล', 'แก้ไขข้อมูล'),
        CANCEL_QUICK_REPLY_ITEM,
      ]),
    ],
    nextSession: { step: 'AWAIT_CONFIRM', data },
  };
}

async function handleStep(userId, step, data, text, messageEvent) {
  switch (step) {
    case 'AWAIT_DRAWING': {
      const trimmed = text.trim();
      if (trimmed === DONE_SENDING_FILES_TRIGGER) {
        return askMaterial(data);
      }

      const message = messageEvent.message;
      if (message.type === 'image' || message.type === 'file') {
        const files = data.drawingFileUrls || [];
        files.push(`line-message-id:${message.id}`);
        return askDrawingMore({ ...data, drawingFileUrls: files });
      }

      // Plain text description — append in case they add more detail later.
      const notes = data.notes ? `${data.notes} / ${text}` : text;
      return askDrawingMore({ ...data, notes });
    }

    case 'AWAIT_MATERIAL': {
      const next = { ...data, material: text.replace(/^วัสดุ:\s*/, '') };
      return askProcesses(next);
    }

    case 'AWAIT_PROCESSES': {
      const trimmed = text.trim();
      if (trimmed === 'เสร็จแล้ว') {
        return askQuantity(data);
      }

      // The LIFF checkbox page sends back everything picked as one
      // comma-separated message — treat that as the complete selection.
      const fromLiff = trimmed
        .split(',')
        .map((p) => p.trim())
        .filter((p) => PROCESS_OPTIONS.includes(p));
      if (fromLiff.length) {
        return askQuantity({ ...data, processes: fromLiff });
      }

      // Fallback: tap-one-at-a-time flow.
      const chosen = data.processes || [];
      if (!chosen.includes(trimmed)) {
        chosen.push(trimmed);
      }
      return askProcesses({ ...data, processes: chosen });
    }

    case 'AWAIT_QUANTITY': {
      return askDueDate({ ...data, quantity: text });
    }

    case 'AWAIT_DUE_DATE': {
      return askCustomerName({ ...data, dueDate: text });
    }

    case 'AWAIT_CUSTOMER_NAME': {
      return askContactPhone({ ...data, customerName: text });
    }

    case 'AWAIT_CONTACT_PHONE': {
      return askConfirm({ ...data, contactPhone: text });
    }

    case 'AWAIT_CONFIRM': {
      if (text.trim() === 'แก้ไขข้อมูล') {
        return startQuoteFlow();
      }
      if (text.trim() === 'ยืนยันส่งข้อมูล') {
        await appendQuoteRequest({ userId, ...data });
        await notifyAdmin(userId, `ลูกค้าส่งใบขอเสนอราคาใหม่\n\n${summaryText(data)}`);
        return {
          replyMessages: [textMessage('ได้รับข้อมูลแล้วนะคะ ทีมงานจะตรวจสอบและติดต่อกลับโดยเร็วที่สุดค่ะ 😊')],
          nextSession: null,
        };
      }
      // Unrecognized input at confirm step — show the summary again.
      return askConfirm(data);
    }

    default:
      return startQuoteFlow();
  }
}

module.exports = {
  START_QUOTE_TRIGGERS,
  STAFF_MENU_TRIGGERS,
  FAQ_MENU_TRIGGERS,
  isStartQuoteTrigger,
  isStaffMenuTrigger,
  isFaqMenuTrigger,
  startQuoteFlow,
  handleStep,
  routeToStaff,
};
