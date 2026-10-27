# Business Audit module

Fourth tool in the launcher (tab "Audit" + home card).
Files: `src/audit-core.js` (parsing, checks, scoring, exports), `src/audit.src.html` (UI), `server/audit-server.js` (crawler API), `build.js` (embeds into index.html).

## Why a server
A browser cannot fetch other websites (CORS), and safe crawling (SSRF protection) must run server-side.
Without a server the tool still works in **pasted-source mode** (one page, fewer checks, clearly labelled).

## Run the audit server (Node 18+, no npm install)
    AUDIT_TOKEN=<long-random-secret> PORT=8787 node server/audit-server.js
Optional env: `AUDIT_ALLOW_ORIGIN` (restrict CORS), `AUDIT_RATE` (audits per IP per 10 min, default 6).
Put it behind HTTPS (reverse proxy), then in the tool: Settings > Audit server URL + Access token.
Protections: http/https only, ports 80/443 only, no credentials in URLs, private/loopback/link-local/reserved IPv4+IPv6 blocked,
IP validated at connect time (DNS-rebinding safe), every redirect revalidated (max 5), 8 s timeout, 1.5 MB cap, text content types only,
robots.txt respected, max 15 pages, 30 link checks, 15 image checks, no cookies/credentials sent, no scripts executed, token auth, rate limit.

## Tests
    npm i xlsx jsdom jspdf   # test-only
    node test/audit.test.js && node test/audit.ui.smoke.js

## Limits / not built
No Google Business Profile API or OAuth (checklist is user-entered and labelled unverified). No AI text (no AI provider exists in the app; all findings are deterministic).
No Search Console, Core Web Vitals/Lighthouse, review analysis, backlinks or traffic data. History is per-browser (localStorage), not per-workspace; there is no login in this app.
Server rate limiting is in-memory and per-process. Competitors: only URLs you enter, 3 max.
