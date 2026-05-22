# TurbotaAI — P0 Security Patch Summary

> Date: 2026-05-21  
> Scope: P0 items from external QA audit  
> Branch: fix/p0-security-hardening

---

## P0-1: Private workflow exports excluded from git

**Status: FIXED (automated)**

`docs/private-qa/` and `docs/private/` are now permanently excluded via `.gitignore`.  
n8n workflow exports, assistant prompt files, and any other private QA artifacts must stay in these directories and must never be committed.

**Manual action still required — Vlad:**
1. Rotate the Tavily API key immediately in the Tavily dashboard (https://app.tavily.com).
2. In n8n: open the workflow → remove the hard-coded Tavily API key from the node configuration → create a dedicated **Credential** of type "Tavily API" and reference it from the node.
3. Re-export the workflow JSON only after the key is removed from the node body. Verify the exported JSON contains no `tvly-*` strings before sharing.

---

## P0-2: SSRF-vulnerable webhook proxy removed

**Status: FIXED (automated)**

`app/api/webhook-proxy/route.ts` has been deleted.  
The endpoint accepted arbitrary `webhookUrl` values and made unauthenticated server-side HTTP requests to any host — a textbook SSRF vector.  
Audit confirmed **zero callers** anywhere in the codebase (web, mobile, or API). Removal is safe.

---

## .gitignore hardening

Added rules to block:
- `docs/private-qa/` — n8n workflow exports, prompt files
- `docs/private/` — any future private docs
- `.env.*` — all real env files (`.env.example` and `.env.*.example` explicitly allowed)

---

## Rebuild / Redeploy requirements

| Target | Required? | Reason |
|---|---|---|
| Mobile rebuild (iOS / Android) | **No** | No files under `apps/mobile/` changed |
| Web / Vercel redeploy | **Yes** | `app/api/webhook-proxy/route.ts` deleted; Next.js route removed |

---

## Files changed in this patch

| File | Change |
|---|---|
| `.gitignore` | Added rules for `docs/private-qa/`, `docs/private/`, `.env.*` |
| `app/api/webhook-proxy/route.ts` | Deleted (dead code, SSRF risk) |
| `docs/qa/SECURITY_PATCH_SUMMARY.md` | This file (internal audit note) |
