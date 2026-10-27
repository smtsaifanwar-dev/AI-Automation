# BizPilot

Three tools in one page, all running in the browser (no server, files are never uploaded):

| Tool | Source | What it does |
|---|---|---|
| Clean Excel | `src/clean.src.html` | Fixes spaces, dates, duplicates, phones, emails; logs every change |
| Invoices | `src/invoice.src.html` | Reads PDF/JPG/PNG invoices (scans via OCR), checks totals/GST/duplicates, exports Excel/CSV, **Send to Payments** |
| Payments | `src/payments.src.html` + `src/core.js` | Outstanding/overdue, payments, follow-ups, reminder drafts (copy / WhatsApp / email app), backup & restore |

## One-click flows
- **Invoices → Payments:** after processing, click *Send to Payments →*. The first time you pick which name is your business (saved), then *Import*.
- **Drop a payment sheet** on the home page or the Payments > Import tab. Amounts like `Rs 5000/-`, `1.234,50`, dates like `5-Mar-2026` and Excel date numbers are understood.

- **After every import** a summary popup shows how many invoices are overdue / due soon, with *Show overdue only*, *Show all invoices* and *Draft reminders*. The Invoices tab has quick chips (All / Overdue / Due soon / Due in 7 days) and overdue rows are highlighted red.

## Develop
```
node build.js          # re-embeds src/*.html into index.html (edit src/, never the base64 blocks)
npm test               # pure-logic tests (no browser)
npm run test:e2e       # real Chromium test: scan -> OCR (stubbed engine) -> Send to Payments -> import
```
`index.html` is the only file you need to deploy or double-click.

## Known limits
- Needs internet for: SheetJS and pdf.js (CDN, with a second CDN as fallback) and, only for scans, the OCR engine (Tesseract.js, English). Vendor these files into the repo if you need fully offline use.
- OCR is less accurate than text PDFs; OCR'd invoices are always marked *Needs Review*.
- Payment data lives in browser localStorage (~5 MB). Use *Download backup (JSON)* regularly.
- Reminders are prepared, never sent automatically (sending needs a server or a business API).
