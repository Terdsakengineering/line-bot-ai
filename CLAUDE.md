# CLAUDE.md — LINE Bot AI Project

## What we're building

LINE Official Account bot for เทอดศักดิ์กลการ จำกัด (โรงงาน CNC รับกัด กลึง เจียร
และเจาะรู Gundrill) ตอบลูกค้า 24 ชม. โดยใช้ Gemini อ่าน FAQ จาก Google Sheet
(fallback เป็นไฟล์ในโค้ดถ้าดึงไม่ได้) แล้วส่ง reply กลับ LINE คำถามที่ลูกค้า
ต้องการคุยกับคน/ร้องเรียน จะถูกส่งต่อ (handoff) ไปหาแอดมิน (1:1 หรือกลุ่ม LINE)
แทนการให้ AI ตอบ นอกจากนี้มีระบบขอใบเสนอราคาแบบ step-by-step (quote flow) ที่
เก็บสถานะและบันทึกผลลง Google Sheets ผ่าน Service Account

## Stack — locked

- Node.js (CommonJS, ไม่ใช้ TypeScript/Next.js — ตั้งใจให้เป็น plain Vercel
  serverless function เพื่อความเรียบง่ายและ deploy เร็ว)
- `@line/bot-sdk` สำหรับ LINE Messaging API
- `@google/genai` สำหรับ Gemini (ต้องโหลดด้วย dynamic `import()` เพราะเป็น
  ESM-only package — ดู lib/gemini.js)
- Google Sheet CSV public URL สำหรับ FAQ (ไม่บังคับ, มี data/faq.csv เป็น fallback)
- Vercel Hobby tier

## Repo conventions

- `api/line-webhook.js` — POST handler เดียว (verify signature → staff trigger
  → quote flow → handoff/guardrail → Gemini → reply พร้อม retry) คืน 200 เสมอ
  หลัง signature ผ่าน เพื่อกัน LINE retry ซ้ำ
- `lib/faqSource.js` — fetch + validate + cache CSV (TTL 60 วินาที)
- `lib/gemini.js` — เรียก Gemini พร้อม timeout + retry (ยกเว้น 429 quota
  exceeded ไม่ retry เพราะเสียโควต้าเปล่า) และ truncation guard
- `lib/handoff.js` — ตรวจ keyword ที่ควรส่งต่อคน + แจ้งแอดมิน (1:1 หรือกลุ่ม)
  `notifyAdmin` ต้อง catch error ของตัวเองเสมอ ห้ามปล่อยให้ throw ออกไป เพราะ
  จะทำให้ caller (handoff/quoteFlow) ข้าม step เคลียร์ session หรือ reply
  ลูกค้าไปด้วย (เคยเป็นบั๊กมาแล้ว)
- `lib/guardrail.js` — เช็คคำต้องห้าม (ราคา/tolerance/กำหนดส่ง) ก่อนเรียก
  Gemini เสมอ ต้องเช็คนี้ก่อน ไม่ใช่ฝากไว้ใน prompt เพราะ prompt อาจหลุดได้
- `lib/quoteFlow.js` — state machine ของ flow ขอใบเสนอราคา (step 0-7)
- `lib/sessionState.js` / `lib/quoteRequests.js` / `lib/sheetsClient.js` —
  อ่าน/เขียน Google Sheets ผ่าน Service Account (JWT auth)
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
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (จำเป็นสำหรับ quote flow)
- `SHEET_ID_QUOTE_REQUESTS` / `SHEET_ID_SESSION_STATE` (จำเป็นสำหรับ quote flow)
- `SHEET_TAB_QUOTE_REQUESTS` / `SHEET_TAB_SESSION_STATE` (optional, default `Sheet1`)

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

## หมายเหตุ

- ลิสต์ `BLOCKED_KEYWORDS` ใน `lib/guardrail.js` มาจากการเดาความหมายจากไฟล์
  spec ที่ encoding เพี้ยน (ตัวอักษรไทยอ่านไม่ออกตรงๆ) เจ้าของธุรกิจอนุมัติให้
  ใช้ไปก่อนได้ แต่ควรตรวจทานอีกครั้งและปรับตามคำที่ลูกค้าใช้จริงเมื่อมีข้อมูล
- ชื่อแท็บ (sheet tab) ของ `TSE_Quote_Requests` / `TSE_Session_State` สมมติ
  เป็น `Sheet1` ไว้ก่อน ถ้าไม่ตรงต้องตั้ง `SHEET_TAB_QUOTE_REQUESTS` /
  `SHEET_TAB_SESSION_STATE` ให้ตรงชื่อจริง ไม่งั้น sessionState/quoteRequests
  จะอ่าน/เขียนผิดชีท
