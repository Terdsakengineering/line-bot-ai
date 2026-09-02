# line-bot-ai

LINE OA chatbot สำหรับ **เทอดศักดิ์กลการ จำกัด** (โรงงาน CNC รับกัด กลึง เจียร และเจาะรู Gundrill)
ตอบลูกค้าอัตโนมัติด้วย Gemini (`@google/genai`) โดยอ้างอิงคำตอบจาก FAQ เท่านั้น (ดึงจาก Google Sheet ผ่าน `SHEET_CSV_URL` ถ้าตั้งไว้ ไม่งั้น fallback ไปที่ [data/faq.csv](data/faq.csv))
คำถามที่ลูกค้าต้องการคุยกับคน/ร้องเรียน จะถูกส่งต่อ (Smart Handoff) ไปหาแอดมิน (1:1 หรือกลุ่ม LINE) แทนการให้ AI ตอบ
ดีพลอยเป็น Vercel Serverless Function

ดู [CLAUDE.md](CLAUDE.md) และ [PRD.md](PRD.md) สำหรับบริบท/ขอบเขตของโปรเจกต์แบบละเอียด และ [TESTS.md](TESTS.md) สำหรับชุดคำถามทดสอบบอทหลัง deploy

## โครงสร้างโปรเจกต์

```
api/line-webhook.js    Vercel serverless function รับ webhook จาก LINE (signature → handoff check → Gemini → reply พร้อม retry)
lib/lineClient.js      LINE Messaging API client
lib/gemini.js          เรียก Gemini พร้อม timeout 8 วินาที + truncation guard, fallback เมื่อไม่มีคำตอบใน FAQ
lib/handoff.js         ตรวจ keyword ที่ควรส่งต่อคน + แจ้งเตือนแอดมิน (1:1 หรือกลุ่ม)
lib/buildPrompt.js      ประกอบ prompt จาก template + FAQ
lib/faqSource.js        โหลด FAQ CSV จาก SHEET_CSV_URL (cache 60 วินาที) หรือ fallback ไป data/faq.csv
lib/promptTemplate.js   system prompt template (role/guardrails/reasoning_protocol/output_format)
lib/constants.js        ข้อความ default reply / handoff reply ส่วนกลาง
lib/log.js              structured JSON logging helper
lib/getRawBody.js       อ่าน raw request body สำหรับตรวจ signature
data/faq.csv            ข้อมูล FAQ สำรอง (question,answer) ใช้เมื่อดึง SHEET_CSV_URL ไม่ได้
vercel.json             ปิด auto framework detection ของ Vercel + ตั้ง maxDuration ของ webhook function
```

## ติดตั้ง

```bash
npm install
```

## ตั้งค่า environment variables

คัดลอก `.env.example` เป็น `.env` แล้วกรอกค่า:

```
LINE_CHANNEL_ACCESS_TOKEN=   # จาก LINE Developers Console > Messaging API
LINE_CHANNEL_SECRET=         # จาก LINE Developers Console > Basic settings
GEMINI_API_KEY=              # จาก Google AI Studio
GEMINI_MODEL=gemini-3.6-flash
SHEET_CSV_URL=               # ไม่บังคับ — ลิงก์ Google Sheet ที่แชร์แบบ CSV สำหรับ FAQ
ADMIN_TARGET_ID=             # ไม่บังคับแต่แนะนำ — LINE user ID (1:1) หรือ group ID สำหรับรับแจ้งเตือน Smart Handoff
```

เมื่อ deploy บน Vercel ให้ตั้งค่าตัวแปรเดียวกันนี้ใน Project Settings > Environment Variables — **ชื่อตัวแปรต้องสะกดตรงตัวพิมพ์ใหญ่-เล็กทุกตัวอักษร** (case-sensitive)

### วิธีหา ADMIN_TARGET_ID

**แบบ 1:1 กับแอดมินคนเดียว (แนะนำ ง่ายกว่า — ไม่ต้องพึ่งฟีเจอร์เชิญเข้ากลุ่มของ LINE OA)**

1. ให้แอดมิน/เจ้าของแอดบอทเป็นเพื่อนใน LINE แล้วทักทายบอท 1 ครั้ง (พิมพ์อะไรก็ได้)
2. ดู Vercel Runtime Logs (`npx vercel logs <deployment-url>`) จะมี log
   `reply.sent` พร้อม `userId` ให้ copy ค่านั้นไปตั้งเป็น `ADMIN_TARGET_ID`
3. Redeploy ให้ค่าตัวแปรใหม่มีผล

**แบบกลุ่ม (ถ้า LINE OA ของคุณรองรับการถูกเชิญเข้ากลุ่ม)**

1. เชิญบอทเข้ากลุ่ม LINE ของแอดมิน แล้วพิมพ์ข้อความอะไรก็ได้ในกลุ่ม 1 ครั้ง
2. ดู Vercel Runtime Logs จะมี log `source.group_seen` พร้อม `groupId` ให้ copy ไปตั้งเป็น `ADMIN_TARGET_ID` แทน

## รันทดสอบ local

```bash
npx vercel dev
```

แล้วใช้ ngrok หรือเครื่องมือ tunnel อื่นเปิด endpoint `http://localhost:3000/api/line-webhook` ออกสู่อินเทอร์เน็ต เพื่อตั้งเป็น Webhook URL ใน LINE Developers Console

## Deploy บน Vercel

```bash
npx vercel deploy --prod
```

จากนั้นนำ URL ที่ได้ (เช่น `https://your-project.vercel.app/api/line-webhook`) ไปตั้งเป็น Webhook URL ใน LINE Developers Console > Messaging API และเปิด "Use webhook"

## แก้ไข FAQ

ถ้าตั้ง `SHEET_CSV_URL` ไว้ ให้แก้ FAQ ที่ Google Sheet นั้นได้เลย (ต้องแชร์แบบ "Anyone with the link" หรือ Publish to web เป็น CSV) ระบบ cache ผลไว้ 60 วินาที แก้แล้วรอสักครู่ค่อยทดสอบ

ถ้าไม่ได้ตั้ง `SHEET_CSV_URL` (หรือดึงจาก sheet ไม่สำเร็จ) บอทจะใช้ไฟล์ [data/faq.csv](data/faq.csv) แทน — แก้เป็น 2 คอลัมน์ `question,answer`

ไม่ว่าจะแหล่งไหน บอทจะตอบตามข้อมูลนี้เท่านั้น ถ้าคำถามลูกค้าไม่มีคำตอบใน FAQ บอทจะขอเบอร์โทรลูกค้าเพื่อให้เจ้าหน้าที่ติดต่อกลับแทน

## Smart Handoff

ถ้าข้อความลูกค้ามีคำที่บ่งบอกว่าต้องการคุยกับคน/ร้องเรียน (ดูลิสต์ใน `lib/handoff.js` ตัวแปร `HANDOFF_TRIGGERS`) บอทจะ**ไม่**เรียก Gemini แต่จะ:

1. ส่งข้อความแจ้งเตือน (พร้อม user ID และข้อความลูกค้า) ไปหา `ADMIN_TARGET_ID`
2. ตอบลูกค้าสั้นๆ ว่าจะมีเจ้าหน้าที่ติดต่อกลับ

ถ้ายังไม่ได้ตั้ง `ADMIN_TARGET_ID` บอทยังคงตอบลูกค้าได้ปกติ แต่จะไม่มีข้อความแจ้งเตือนไปหาแอดมิน (มี log เตือนไว้ใน Vercel logs)

เพิ่ม/แก้คำ trigger ได้ที่ `HANDOFF_TRIGGERS` ใน `lib/handoff.js` ตามคำที่ลูกค้าใช้จริง
