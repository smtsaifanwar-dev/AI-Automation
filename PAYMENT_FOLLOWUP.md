# Payment Follow-up module

Third tool in the launcher (tab "Payments" + home card). Source: `src/core.js` (pure logic), `src/payments.src.html` (UI).
Rebuild: `node build.js` (writes `payments.html` and re-embeds all three tools from `src/` into `index.html`; safe to re-run).
Tests: `npm i xlsx jsdom && node test/core.test.js && node test/ui.smoke.js`

Storage: browser localStorage only (~5 MB). No backend, login or workspaces exist in this app, so none were added.
Money is stored as integer minor units; currencies are never summed together. Nothing is ever sent.
Invoice Processing link: the Invoices tool has a *Send to Payments* button (no download/upload). Only rows where *you* are the supplier become receivables; if your business name is not saved yet, the import screen asks once which name is yours.
Backup/restore: Import / Export > *Download backup (JSON)* / *Restore from backup*.
Not built: update-on-duplicate (duplicates are skipped), separate follow-up queue tab, automatic sending.
