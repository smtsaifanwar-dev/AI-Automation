# Changes in 1.2.0 (reliability pass)

## Invoice reader (`src/invoice-core.js`, new; embedded into the Invoices tool by `build.js`)
- **Amounts:** `1 234,50` was read as 123450 (100x) and `1.234,63` as 463. One parser now handles Indian, European, spaced, `/-`, `(negative)` and currency-prefixed amounts. Junk returns NaN, never a wrong number.
- **Dates:** `October 27, 2026` / `Oct 27th 2026` are now read (the date was previously missed).
- **Totals:** `Net Total`, `Invoice Value`, `Bill Amount`, `Amount Due`, `Balance Due`, `Total Payable` are recognised, and those rows no longer turn into fake line items.
- **Parties:** `To:` and `Details of Receiver/Supplier` labels are understood.
- **Supplier guessing:** a date, `Subtotal`, `Qty`, `Rate`, `VAT`... can no longer be returned as the supplier. A guess from far down the page is LOW confidence, so it is flagged for review.
- **Currency:** a GST invoice with no symbol is read as INR.

## Payments (`src/payments.src.html`)
- If saved data exists but cannot be read (damaged, or written by a newer version) the app no longer silently starts blank and overwrites it on the next save. It now protects the data, shows a banner, and offers: download the unreadable data / restore a backup / start fresh (with confirm).

## Tests and build
- `test/invoice.test.js` (new, 18 tests, no dependencies): amount and date formats, 10 invoice fixtures, supplier-guess safety, build-sync check, and the payments data-protection logic.
- `npm test` now runs payments core + invoice tests. `build.js` embeds `invoice-core.js`.
- Verified in a real Chromium on the built `index.html`: tools load without JS errors, the in-browser parser matches Node, damaged data survives a save attempt byte-for-byte, raw download works, valid data still loads and saves.

## Known, not fixed yet
- VAT / a single "GST" line is not a supported tax field (the total check flags it loudly).
- CDN libraries are not vendored and have no SRI hashes; the Invoices tool still has no CSP (needs network to vendor; OCR must be re-tested after).
- Storage is still localStorage (no IndexedDB / auto-backup). Audit module, branding, Web Worker for large Excel files: unchanged.

# UI polish pass (Phase 1)
- Shared look: one primary blue in the shell, sticky blurred header, privacy pill moved out of the tab list (and hidden on small screens), SVG lock instead of emoji.
- Mobile: tabs scroll horizontally, no sideways page overflow (verified at 390px).
- Home: 3-step strip, file-type chips, compact task cards with icons and an "Open" button, trust row.
- All tools: shared base style injected into each iframe (fixes the background seam, consistent font, reduced-motion support).
- Phase 2 (not done yet): Invoices/Payments/Audit result screens, status chips, toasts, demo data, tool-level token unification.

# Phase 2a (Payments)
- Column mapping shows readable names (Invoice number, Due date, ...) instead of camelCase keys.
- "Theme" label next to the colour dots; shorter Settings labels; consistent label sizes.
- "Missing, please review" warning now has an "Open Settings" button.

# Phase 2b (Payments)
- Banner now says how many invoices are ready, how many duplicates were skipped and how many need fixing, and that nothing is saved yet.
- Dates in the invoices table and follow-up list read "17 Oct 2026" (stored values are unchanged).
- Invoices filter: the dropdown is now "More filters..." and no longer repeats the chips (Overdue / Due soon / Due in 7 days).
- Column header "Next follow-up"; whole row is clickable (Open button kept for keyboard/screen-reader use).
- Import: drop zone with icon and a "Try with demo data" button (8 sample invoices, dates relative to today, nothing saved until Import).

# Phase 2c
Payments (small items)
- Invoice detail popup shows the due date as "30 Oct 2026".
- The "ready to import" toast is cleared once you import.
- The empty Overview screen has a "Try with demo data" button.
Invoices (OCR tool)
- Duplicate inner header hidden when the tool runs inside BizPilot.
- Drop zone with icon, file-type chips and a button; the Process button shows the file count.
- Privacy / OCR / fingerprint text is collapsed behind "How privacy, OCR and duplicate checks work".
- Summary cards are tinted (amber: needs review / duplicates, red: failed / mismatches, green: processed).
Audit
- Website score shown large with a green / amber / red colour; links use the theme blue.
- Action plan grouped with colour dots, counts and one card per recommendation.
All tools: one primary blue (#2563eb light, #5b9bff dark).

# Phase 3 – Excel cleaner (CleanSheet)
**Header dropdown = every value in the column (like Excel's filter list, but it spots mistakes)**
- Click any column name: "All values in this column" lists every distinct value with its count, search box, order (most used / A→Z).
- Mistakes are flagged with a reason: different capitalisation or spacing (`delhi`, `DELHI`, `"Delhi "`), typos of a much more common value (`Mumbay`, `Dehli`), a number in a text column, text in a number column. Values that appear once in a tidy category list get a soft hint only.
- No false alarms by design: `Male/Female`, `UP/MP`, `Zone 1/Zone 2`, and columns of mostly-different names are never "typo-checked".
- One click fixes: `→ Delhi` per value, **Fix all N**, or `✎ Change to…` (pick an existing value from the list or type a new one) to rename a whole category. Every bulk fix has an **Undo** button, and shows in the download's *Applied Changes* sheet as "Edited by you".
- The table shows it too: orange `≠ N` badge on the header, orange dashed cells (click one: the suggested spelling is pre-filled; "Fine for all N" dismisses). "Only problems" includes them.
- Tick values and press **Show only ticked values in table** to filter rows; a bar above the table clears it.
**Excel realities**
- Download now always contains the untouched original sheet(s) as `Original - <sheet>` (formulas and number formats intact); before, the sheet you cleaned was not included.
- On load a note explains formulas (and never-calculated ones), merged cells and Excel error cells (#N/A, #REF! are read as blank).
- Manual fixes now apply and download even when no automatic cleaning step ran (previously ignored).
- Files over ~1.5 MB and bulk fixes on 8,000+ rows show a "working" overlay instead of looking frozen. (Measured: 50,000 rows load in ~6 s in the test harness. A Web Worker was NOT added.)
**Code/tests:** new `src/clean-values.js` (pure logic, embedded by `build.js`), `test/clean.values.test.js` (12), `test/clean.ui.test.js` (30, real UI in jsdom). `npm test` includes the logic tests; `npm run test:clean` runs the UI test.
**Known:** `test/ui.smoke.js` (payments) already fails on the Phase 2c zip (stale expectations) – untouched. Not checked in a real browser yet, only jsdom: please open index.html and try a messy file.

# Phase 4 – one drop zone that decides for you + backup reminder
**Home page smart drop zone (`src/detect.js`, embedded in `index.html` by `build.js`)**
- Drop any file: PDF/JPG/PNG go to Invoices; an Excel/CSV is read (headers only, on this device) and sent to the right tool. A sheet that tracks money owed (invoice no or customer + due date / paid / balance + an amount) opens in **Payment Follow-up**; anything else opens in the **Excel cleaner**. No more "what should we do with it?" for obvious files.
- Always reversible: a note says where the file went and why, with a one-click "Use ... instead" button (nothing is saved to Payments until you press Import, so switching costs nothing).
- When it is not sure (e.g. an invoice register with no due date), it still asks, with the likely choice highlighted and the reason shown. If the file cannot be read, or SheetJS cannot load (offline / 6 s timeout per CDN), it asks instead of hanging.
**Payment Follow-up: backup reminder**
- Data lives only in the browser, so a banner appears once there are invoices and there is no backup, or the last one is 7+ days old: "Download backup" (one click, remembers the date) or "Remind me later" (3 days). Never shown while data is unreadable or a save error is already displayed.
**Tests:** `test/detect.test.js` (13), `test/home.smart.test.js` (14, real home page in jsdom), `test/payments.backup.test.js` (10). Run `npm test`, `npm run test:home`, `npm run test:backup`, `npm run test:clean`.
**Known:** `test/ui.smoke.js` is stale since Phase 2 (looks for elements that were renamed) and still fails; it is not part of `npm test`. Everything was verified in jsdom only, not in a real browser.

# Launch-readiness pass (1.4.0)
- **Local-first libraries:** all four tools and the home page now try `vendor/<lib>` first, then the CDNs. `node vendor.js` downloads SheetJS, pdf.js (+worker) and jsPDF and writes `vendor/MANIFEST.json` with SRI hashes. If `vendor/` is absent nothing changes. CSP in Clean / Payments / Audit now allows `'self'` for this.
- **Home page:** footer with version, *Privacy & Terms* and *Help & feedback* dialogs (Esc / click outside closes). Contact details come from `BP_CONTACT` in `index.html` (empty = no contact line shown).
- **Payments:** asks the browser for persistent storage (`navigator.storage.persist()`) so saved data is less likely to be evicted. Backups are still needed.
- **Removed** `test/ui.smoke.js` (stale since Phase 2, replaced by backup / e2e tests) and its `test:ui` script.
- **Not done (needs network / a real browser):** SRI on CDN tags and vendoring the OCR engine; CSP for the Invoices tool (OCR uses workers + wasm, a wrong CSP would silently break it; add it only after testing OCR); IndexedDB storage; real-browser testing; Web Worker for 50k-row sheets.
