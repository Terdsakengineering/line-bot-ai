# line-bot-ai

LINE OA chatbot สำหรับ **เทอดศักดิ์กลการ จำกัด** (โรงงาน CNC รับกัด กลึง เจียร และเจาะรู Gundrill)
ตอบลูกค้าอัตโนมัติด้วย Gemini (`@google/genai`) โดยอ้างอิงคำตอบจาก FAQ ใน [data/faq.csv](data/faq.csv) เท่านั้น
ดีพลอยเป็น Vercel Serverless Function

## โครงสร้างโปรเจกต์

```
api/webhook.js        Vercel serverless function รับ webhook จาก LINE
lib/lineClient.js      LINE Messaging API client
lib/gemini.js          เรียก Gemini และ fallback เมื่อไม่มีคำตอบใน FAQ
lib/buildPrompt.js      ประกอบ prompt จาก template + faq.csv
lib/promptTemplate.js   system prompt template (role/constraints/output_format)
lib/getRawBody.js       อ่าน raw request body สำหรับตรวจ signature
data/faq.csv            ข้อมูล FAQ (question,answer) — แก้ไข/เพิ่มได้ตามจริง
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
GEMINI_MODEL=gemini-2.5-flash
```

เมื่อ deploy บน Vercel ให้ตั้งค่าตัวแปรเดียวกันนี้ใน Project Settings > Environment Variables

## รันทดสอบ local

```bash
npx vercel dev
```

แล้วใช้ ngrok หรือเครื่องมือ tunnel อื่นเปิด endpoint `http://localhost:3000/api/webhook` ออกสู่อินเทอร์เน็ต เพื่อตั้งเป็น Webhook URL ใน LINE Developers Console

## Deploy บน Vercel

```bash
npx vercel deploy --prod
```

จากนั้นนำ URL ที่ได้ (เช่น `https://your-project.vercel.app/api/webhook`) ไปตั้งเป็น Webhook URL ใน LINE Developers Console > Messaging API และเปิด "Use webhook"

## แก้ไข FAQ

แก้ไขไฟล์ [data/faq.csv](data/faq.csv) เป็น 2 คอลัมน์ `question,answer` บอทจะตอบตามข้อมูลนี้เท่านั้น ถ้าคำถามลูกค้าไม่มีคำตอบใน FAQ บอทจะขอเบอร์โทรลูกค้าเพื่อให้เจ้าหน้าที่ติดต่อกลับแทน
