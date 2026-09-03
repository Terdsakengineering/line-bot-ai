# AGENTS.md — LINE Bot AI Project

## What we're building

LINE Official Account bot for เทอดศักดิ์กลการ จำกัด (โรงงาน CNC รับกัด กลึง เจียร
และเจาะรู Gundrill) ตอบลูกค้า 24 ชม. โดยใช้ Gemini อ่าน FAQ จาก Google Sheet
(fallback เป็นไฟล์ในโค้ดถ้าดึงไม่ได้) แล้วส่ง reply กลับ LINE คำถามที่ลูกค้า
ต้องการคุยกับคน/ร้องเรียน จะถูกส่งต่อ (handoff) ไปหาแอดมิน (1:1 หรือกลุ่ม LINE)
แทนการให้ AI ตอบ

## Stack — locked

- Node.js (CommonJS, ไม่ใช้ TypeScript/Next.js — ตั้งใจให้เป็น plain Vercel
  serverless function เพื่อความเรียบง่ายและ deploy เร็ว)
- `@line/bot-sdk` สำหรับ LINE Messaging API
- `@google/genai` สำหรับ Gemini (ต้องโหลดด้วย dynamic `import()` เพราะเป็น
  ESM-only package — ดู lib/gemini.js)
- Google Sheet CSV public URL สำหรับ FAQ (ไม่บังคับ, มี data/faq.csv เป็น fallback)
- Vercel Hobby tier

## Repo conventions

- `api/line-webhook.js` — POST handler เดียว (verify signature → handoff check
  → Gemini → reply พร้อม retry) คืน 200 เสมอหลัง signature ผ่าน เพื่อกัน LINE
  retry ซ้ำ
- `lib/faqSource.js` — fetch + validate + cache CSV (TTL 60 วินาที)
- `lib/gemini.js` — เรียก Gemini พร้อม timeout 8 วินาที และ truncation guard
- `lib/handoff.js` — ตรวจ keyword ที่ควรส่งต่อคน + แจ้งแอดมิน (1:1 หรือกลุ่ม)
- `lib/promptTemplate.js` / `lib/buildPrompt.js` — system prompt (guardrails +
  reasoning protocol) ประกอบกับ FAQ
- `lib/log.js` — structured JSON logging helper
- `lib/lineClient.js` — LINE Messaging API client (ใช้ร่วมกันทั้ง reply/push)

## Env vars (Vercel)

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, default `gemini-3.6-flash`)
- `SHEET_CSV_URL` (optional — ไม่ตั้งจะใช้ data/faq.csv)
- `ADMIN_TARGET_ID` (Smart Handoff target — LINE user ID หรือ group ID, optional แต่แนะนำให้ตั้ง)

ชื่อตัวแปรต้องสะกดตรงตัวพิมพ์ใหญ่-เล็กทุกตัวอักษร (case-sensitive) —
เคยเกิดปัญหา 500 เพราะตั้งชื่อผิด case มาแล้ว

## Don'ts

- ห้าม hardcode token/key ใดๆ — ใช้ env vars เท่านั้น
- ห้ามข้าม signature verification — เป็นความเสี่ยงด้าน security
- ห้ามข้าม timeout ตอนเรียก Gemini — webhook ควร reply ให้ทันก่อน Vercel
  function timeout
- ห้าม cache FAQ นานเกิน 60 วินาทีเมื่อ owner แก้ Google Sheet ต้องเห็นผลไว
- ห้าม log เนื้อหาข้อความลูกค้าแบบเต็ม — log เฉพาะ metadata (latency, length,
  userId) ยกเว้นข้อความที่ส่งต่อให้แอดมินจริงตอน handoff ซึ่งจำเป็นต้องเห็น
  เนื้อหาเต็มเพื่อช่วยลูกค้า
