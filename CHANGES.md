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
