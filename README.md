# line-bot-ai

LINE OA chatbot สำหรับ **เทอดศักดิ์กลการ จำกัด** (โรงงาน CNC รับกัด กลึง เจียร และเจาะรู Gundrill)
ตอบลูกค้าอัตโนมัติด้วย Gemini (`@google/genai`) โดยอ้างอิงคำตอบจาก FAQ เท่านั้น (ดึงจาก Google Sheet ผ่าน `SHEET_CSV_URL` ถ้าตั้งไว้ ไม่งั้น fallback ไปที่ [data/faq.csv](data/faq.csv))
คำถามที่ลูกค้าต้องการคุยกับคน/ร้องเรียน จะถูกส่งต่อ (Smart Handoff) ไปกลุ่ม LINE ของแอดมินแทนการให้ AI ตอบ
ดีพลอยเป็น Vercel Serverless Function

ดู [CLAUDE.md](CLAUDE.md) และ [PRD.md](PRD.md) สำหรับบริบท/ขอบเขตของโปรเจกต์แบบละเอียด และ [TESTS.md](TESTS.md) สำหรับชุดคำถามทดสอบบอทหลัง deploy

## โครงสร้างโปรเจกต์

```
api/line-webhook.js    Vercel serverless function รับ webhook จาก LINE (signature → handoff check → Gemini → reply พร้อม retry)
lib/lineClient.js      LINE Messaging API client
lib/gemini.js          เรียก Gemini พร้อม timeout 8 วินาที + truncation guard, fallback เมื่อไม่มีคำตอบใน FAQ
lib/handoff.js         ตรวจ keyword ที่ควรส่งต่อคน + แจ้งเตือนกลุ่มแอดมิน
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
ADMIN_GROUP_ID=              # ไม่บังคับแต่แนะนำ — LINE group ID สำหรับรับแจ้งเตือน Smart Handoff
```

เมื่อ deploy บน Vercel ให้ตั้งค่าตัวแปรเดียวกันนี้ใน Project Settings > Environment Variables — **ชื่อตัวแปรต้องสะกดตรงตัวพิมพ์ใหญ่-เล็กทุกตัวอักษร** (case-sensitive)

### วิธีหา ADMIN_GROUP_ID

1. สร้างกลุ่ม LINE แล้วเชิญบอทเข้ากลุ่ม (Add เป็นเพื่อนในกลุ่ม)
2. พิมพ์ข้อความอะไรก็ได้ในกลุ่มนั้น 1 ครั้ง
3. ดู Vercel Runtime Logs (`npx vercel logs <deployment-url>`) จะมี log
   `source.group_seen` พร้อม `groupId` ให้ copy ค่านั้นไปตั้งเป็น `ADMIN_GROUP_ID`
4. Redeploy ให้ค่าตัวแปรใหม่มีผล

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

1. ส่งข้อความแจ้งเตือน (พร้อม user ID และข้อความลูกค้า) เข้ากลุ่ม `ADMIN_GROUP_ID`
2. ตอบลูกค้าสั้นๆ ว่าจะมีเจ้าหน้าที่ติดต่อกลับ

ถ้ายังไม่ได้ตั้ง `ADMIN_GROUP_ID` บอทยังคงตอบลูกค้าได้ปกติ แต่จะไม่มีข้อความแจ้งเตือนไปที่กลุ่ม (มี log เตือนไว้ใน Vercel logs)

เพิ่ม/แก้คำ trigger ได้ที่ `HANDOFF_TRIGGERS` ใน `lib/handoff.js` ตามคำที่ลูกค้าใช้จริง
