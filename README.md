# BizPilot

Four tools in one page, all running in the browser (no server, files are never uploaded):

| Tool | Source | What it does |
|---|---|---|
| Clean Excel | `src/clean.src.html` + `src/clean-values.js` | Fixes spaces, dates, duplicates, phones, emails; logs every change. **Click a column name** to see every value, spot spelling mistakes, fix or filter them in one click |
| Invoices | `src/invoice.src.html` + `src/invoice-core.js` | Reads PDF/JPG/PNG invoices (scans via OCR), checks totals/GST/duplicates, exports Excel/CSV, **Send to Payments** |
| Payments | `src/payments.src.html` + `src/core.js` | Outstanding/overdue, payments, follow-ups, reminder drafts (copy / WhatsApp / email app), backup & restore |
| Audit | `src/audit.src.html` + `src/audit-core.js` + `server/audit-server.js` | Website SEO checks with evidence, business-profile checklist, score, PDF/Excel/CSV report. Live crawling needs the small audit server (see `AUDIT_SETUP.md`); without it, paste one page's HTML source |

## One-click flows
- **Drop any file on the home page:** invoices open the Invoices tool; a spreadsheet is read and sent to Payments (if it looks like a payment sheet) or to the Excel cleaner. A "Use ... instead" button undoes a wrong guess; unsure files are asked about.
- **Backup reminder** in Payments after 7 days without a JSON backup.
- **Invoices → Payments:** after processing, click *Send to Payments →*. The first time you pick which name is your business (saved), then *Import*.
- **Drop a payment sheet** on the home page or the Payments > Import tab. Amounts like `Rs 5000/-`, `1.234,50`, dates like `5-Mar-2026` and Excel date numbers are understood.

- **After every import** a summary popup shows how many invoices are overdue / due soon, with *Show overdue only*, *Show all invoices* and *Draft reminders*. The Invoices tab has quick chips (All / Overdue / Due soon / Due in 7 days) and overdue rows are highlighted red.

## Develop
```
node build.js          # re-embeds src/*.html into index.html (edit src/, never the base64 blocks)
npm test               # pure-logic tests, no browser: payments core + invoice reader (amounts, dates, fields, validation, build sync, data-safety)
npm run test:audit     # Business Audit engine, SSRF protection, exports, UI (needs: npm i)
npm run test:e2e       # real Chromium test: scan -> OCR (stubbed engine) -> Send to Payments -> import
```
`index.html` is the only file you need to deploy or double-click.

## Invoice reader accuracy
Parsing and validation live in `src/invoice-core.js` (pure functions, unit-tested in `test/invoice.test.js`). It reads Indian (`1,18,000.00`), European (`1.234,50`), spaced (`1 234,50`) and `5000/-` amounts, numeric / `15-Oct-2026` / `October 27, 2026` dates, and common label variants (Net Total, Invoice Value, Amount Due, To:). When it cannot find a field it says so (a finding) instead of guessing; a supplier guessed from far down the page is marked low confidence. Unsupported tax lines (VAT, a single "GST") make the total check fail loudly rather than pass silently. **Add every invoice layout that fails for you as a fixture in `test/invoice.test.js`.**

## Known limits
- Needs internet for: SheetJS and pdf.js (CDN, with a second CDN as fallback) and, only for scans, the OCR engine (Tesseract.js, English). Vendor these files into the repo if you need fully offline use.
- OCR is less accurate than text PDFs; OCR'd invoices are always marked *Needs Review*.
- Payment data lives in browser localStorage (~5 MB). If saved data ever becomes unreadable, BizPilot stops saving, keeps it untouched and offers *Download the unreadable data* / *Restore from a backup* / *Start fresh*. Still use *Download backup (JSON)* regularly.
- Reminders are prepared, never sent automatically (sending needs a server or a business API).
