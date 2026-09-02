# line-bot-ai

LINE OA chatbot สำหรับ **เทอดศักดิ์กลการ จำกัด** (โรงงาน CNC รับกัด กลึง เจียร และเจาะรู Gundrill)
ตอบลูกค้าอัตโนมัติด้วย Gemini (`@google/genai`) โดยอ้างอิงคำตอบจาก FAQ เท่านั้น (ดึงจาก Google Sheet ผ่าน `SHEET_CSV_URL` ถ้าตั้งไว้ ไม่งั้น fallback ไปที่ [data/faq.csv](data/faq.csv))
ดีพลอยเป็น Vercel Serverless Function

## โครงสร้างโปรเจกต์

```
api/line-webhook.js    Vercel serverless function รับ webhook จาก LINE
lib/lineClient.js      LINE Messaging API client
lib/gemini.js          เรียก Gemini และ fallback เมื่อไม่มีคำตอบใน FAQ
lib/buildPrompt.js      ประกอบ prompt จาก template + FAQ
lib/faqSource.js        โหลด FAQ CSV จาก SHEET_CSV_URL (cache 5 นาที) หรือ fallback ไป data/faq.csv
lib/promptTemplate.js   system prompt template (role/constraints/output_format)
lib/getRawBody.js       อ่าน raw request body สำหรับตรวจ signature
data/faq.csv            ข้อมูล FAQ สำรอง (question,answer) ใช้เมื่อดึง SHEET_CSV_URL ไม่ได้
vercel.json             ปิด auto framework detection ของ Vercel
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
```

เมื่อ deploy บน Vercel ให้ตั้งค่าตัวแปรเดียวกันนี้ใน Project Settings > Environment Variables

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

ถ้าตั้ง `SHEET_CSV_URL` ไว้ ให้แก้ FAQ ที่ Google Sheet นั้นได้เลย (ต้องแชร์แบบ "Anyone with the link" หรือ Publish to web เป็น CSV) ระบบ cache ผลไว้ 5 นาที แก้แล้วรอสักครู่ค่อยทดสอบ

ถ้าไม่ได้ตั้ง `SHEET_CSV_URL` (หรือดึงจาก sheet ไม่สำเร็จ) บอทจะใช้ไฟล์ [data/faq.csv](data/faq.csv) แทน — แก้เป็น 2 คอลัมน์ `question,answer`

ไม่ว่าจะแหล่งไหน บอทจะตอบตามข้อมูลนี้เท่านั้น ถ้าคำถามลูกค้าไม่มีคำตอบใน FAQ บอทจะขอเบอร์โทรลูกค้าเพื่อให้เจ้าหน้าที่ติดต่อกลับแทน
