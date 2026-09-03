# line-bot-ai

LINE OA chatbot สำหรับ **เทอดศักดิ์กลการ จำกัด** (โรงงาน CNC รับกัด กลึง เจียร และเจาะรู Gundrill)
ตอบลูกค้าอัตโนมัติด้วย Gemini (`@google/genai`) โดยอ้างอิงคำตอบจาก FAQ เท่านั้น (ดึงจาก Google Sheet ผ่าน `SHEET_CSV_URL` ถ้าตั้งไว้ ไม่งั้น fallback ไปที่ [data/faq.csv](data/faq.csv))
คำถามที่ลูกค้าต้องการคุยกับคน/ร้องเรียน จะถูกส่งต่อ (Smart Handoff) ไปหาแอดมิน (1:1 หรือกลุ่ม LINE) แทนการให้ AI ตอบ
ดีพลอยเป็น Vercel Serverless Function

ดู [CLAUDE.md](CLAUDE.md) และ [PRD.md](PRD.md) สำหรับบริบท/ขอบเขตของโปรเจกต์แบบละเอียด และ [TESTS.md](TESTS.md) สำหรับชุดคำถามทดสอบบอทหลัง deploy

## โครงสร้างโปรเจกต์

```
api/line-webhook.js    Vercel serverless function รับ webhook จาก LINE (signature → staff trigger → quote flow → handoff/guardrail → Gemini → reply พร้อม retry)
lib/lineClient.js      LINE Messaging API client
lib/gemini.js          เรียก Gemini พร้อม timeout + retry, fallback เมื่อไม่มีคำตอบใน FAQ
lib/handoff.js         ตรวจ keyword ที่ควรส่งต่อคน + แจ้งเตือนแอดมิน (1:1 หรือกลุ่ม)
lib/guardrail.js       เช็คคำต้องห้าม (ราคา/tolerance/กำหนดส่ง ฯลฯ) ก่อนเรียก Gemini เสมอ
lib/quoteFlow.js       state machine ของ flow ขอใบเสนอราคา (step 0-7)
lib/sessionState.js    อ่าน/เขียนสถานะ quote flow ต่อ userId ลง Google Sheet (TSE_Session_State)
lib/quoteRequests.js   บันทึกใบขอเสนอราคาที่ยืนยันแล้วลง Google Sheet (TSE_Quote_Requests)
lib/sheetsClient.js    เชื่อมต่อ Google Sheets API ด้วย Service Account (auth ใช้ร่วมกันทั้ง session/quote)
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
GOOGLE_SERVICE_ACCOUNT_EMAIL=        # จำเป็นสำหรับระบบขอใบเสนอราคา
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=  # จำเป็นสำหรับระบบขอใบเสนอราคา
SHEET_ID_QUOTE_REQUESTS=1QwGekDNcxH_uOKMOtEnIwaC6wnw32Sf-ByRsJ1iQi5M
SHEET_ID_SESSION_STATE=1lq67oXwEE-WS_QFPO1_v8mfMlmvYGK0v8F5suibKH-o
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

## ระบบขอใบเสนอราคา (quote flow)

ลูกค้าพิมพ์ **"ส่งแบบขอใบเสนอราคา"** (หรือกด Rich Menu ปุ่มนี้ถ้าตั้งไว้) จะเริ่ม flow ถามทีละขั้นตอน (ไฟล์แบบงาน → วัสดุ → กระบวนการ → จำนวน/กำหนดส่ง → ข้อมูลติดต่อ → สรุปให้ยืนยัน) แล้วบันทึกลง Google Sheet `TSE_Quote_Requests` พร้อมแจ้งเตือนแอดมิน ทุกขั้นตอนมีปุ่ม **"คุยกับเจ้าหน้าที่"** ให้กดข้ามไปหาคนได้ทันทีถ้าลูกค้าไม่แน่ใจหรือต้องการยกเลิก

สถานะระหว่างทำ flow (session) เก็บไว้ใน Google Sheet `TSE_Session_State` (คีย์ด้วย LINE userId) เพื่อให้ function แบบ serverless (ไม่มี memory ค้างข้ามคำขอ) จำได้ว่าลูกค้าอยู่ขั้นตอนไหน

**ต้องตั้งค่าก่อนใช้งานได้:**

1. สร้าง Google Service Account ใน Google Cloud Console (ต้อง Enable Google Sheets API ด้วย)
2. สร้าง Key แบบ JSON ให้ service account นั้น เก็บ `client_email` และ `private_key` จากไฟล์ที่ได้
3. แชร์สิทธิ์ **Editor** ของ Google Sheet `TSE_Quote_Requests` และ `TSE_Session_State` ให้กับอีเมล service account (`client_email`)
4. ตั้งค่า `GOOGLE_SERVICE_ACCOUNT_EMAIL` และ `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` บน Vercel — ค่า private key มีขึ้นบรรทัดใหม่ (`\n`) ให้ paste ทั้งก้อนไปตรงๆ ได้เลย โค้ดจะแปลงให้เอง
5. หัวคอลัมน์ที่ต้องมีในแต่ละชีท (แถวแรก):
   - `TSE_Quote_Requests`: `Timestamp, LineUserId, CustomerName, ContactPhone, Material, Processes, Quantity, DueDate, DrawingFileURL, Notes, Status`
   - `TSE_Session_State`: `LineUserId, CurrentStep, TempDataJSON, LastUpdated`

ถ้าชื่อแท็บ (sheet tab) ในไฟล์ไม่ใช่ `Sheet1` ให้ตั้ง `SHEET_TAB_QUOTE_REQUESTS` / `SHEET_TAB_SESSION_STATE` ให้ตรงชื่อจริงด้วย

**คำต้องห้าม (guardrail):** คำถามที่มีคำในลิสต์ `BLOCKED_KEYWORDS` ของ `lib/guardrail.js` (เช่น ราคา, tolerance, กำหนดส่ง) จะไม่ถูกส่งให้ Gemini ตอบเลย บอทจะตอบให้กดคุยกับเจ้าหน้าที่แทนทันที เพื่อกันการแต่งราคา/สเปกที่ต้องให้คนตรวจสอบก่อน

### เลือกกระบวนการหลายอันพร้อมกัน (LIFF)

LINE Quick Reply กดได้ทีละปุ่มเท่านั้น ไม่มี checkbox ในตัว ขั้นตอนที่ 3 (เลือกกระบวนการ) จึงใช้หน้าเว็บ LIFF (`public/liff/processes.html`) เป็น checkbox จริงแทน ถ้าไม่ได้ตั้งค่า จะ fallback เป็นแบบแตะทีละอันแล้วกด "เสร็จแล้ว" แทนอัตโนมัติ

**วิธีเปิดใช้งาน:**

1. ไปที่ https://developers.line.biz/console/ → เลือก Provider/Channel เดียวกับ Messaging API
2. ไปที่แท็บ **LIFF** → **Add**
3. ตั้งชื่อ เช่น "เลือกกระบวนการ", Size เลือก **Tall** หรือ **Full**
4. Endpoint URL ใส่ `https://line-bot-ai-3elp.vercel.app/liff/processes.html`
5. Scope ใช้ค่า default ได้เลย (ไม่ต้องเพิ่ม permission พิเศษ เพราะเปิดจากในแชทอยู่แล้ว)
6. กด Add จะได้ **LIFF ID** (หน้าตาประมาณ `1234567890-AbCdEfGh`)
7. เปิดไฟล์ `public/liff/processes.html` แก้บรรทัด `var LIFF_ID = 'LIFF_ID_PLACEHOLDER';` ให้เป็น LIFF ID จริง แล้ว commit + push
8. ตั้งค่า env var `LIFF_PROCESSES_URL` บน Vercel เป็น `https://liff.line.me/<LIFF_ID>` (URL เต็มที่ LINE ให้มาตอนสร้าง LIFF app)
