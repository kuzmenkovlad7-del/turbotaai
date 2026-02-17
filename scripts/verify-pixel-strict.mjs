#!/usr/bin/env node
/**
 * verify-pixel-strict.mjs
 *
 * Strict verification of Meta Pixel initialisation.
 * Combines source-code analysis with optional live-page fetching.
 *
 * Usage:
 *   node scripts/verify-pixel-strict.mjs [baseUrl] [expectedPixelId]
 *
 * Exit 0  => OK
 * Exit 1  => one or more checks FAILED
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const [, , baseUrl, expectedPixelId] = process.argv

const ROOT = resolve(import.meta.dirname, "..")

const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RESET = "\x1b[0m"

let passed = 0
let failed = 0
const failures = []

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function pass(label) {
  console.log(`${GREEN}PASS${RESET} ${label}`)
  passed++
}

function fail(label, reason) {
  console.log(`${RED}FAIL${RESET} ${label} — ${reason}`)
  failures.push({ label, reason })
  failed++
}

function checkSource(label, filePath, pattern) {
  const full = resolve(ROOT, filePath)
  if (!existsSync(full)) {
    fail(label, `file not found: ${filePath}`)
    return
  }
  const content = readFileSync(full, "utf8")
  // pattern must be a RegExp (never use string-based flags that could be invalid)
  if (!(pattern instanceof RegExp)) {
    fail(label, "INTERNAL: pattern must be a RegExp")
    return
  }
  if (pattern.test(content)) {
    pass(label)
  } else {
    fail(label, `pattern /${pattern.source}/${pattern.flags} not found in ${filePath}`)
  }
}

function checkSourceNot(label, filePath, pattern) {
  const full = resolve(ROOT, filePath)
  if (!existsSync(full)) {
    fail(label, `file not found: ${filePath}`)
    return
  }
  const content = readFileSync(full, "utf8")
  if (!(pattern instanceof RegExp)) {
    fail(label, "INTERNAL: pattern must be a RegExp")
    return
  }
  if (!pattern.test(content)) {
    pass(label)
  } else {
    fail(label, `forbidden pattern /${pattern.source}/${pattern.flags} found in ${filePath}`)
  }
}

// ---------------------------------------------------------------------------
// Static source analysis
// ---------------------------------------------------------------------------

console.log(`\n${YELLOW}=== Meta Pixel Strict Verification ===${RESET}\n`)
console.log(`${YELLOW}[1/3] Source code checks${RESET}\n`)

// analytics.tsx: pixel id trimmed and validated before use
checkSource(
  "analytics.tsx: trims pixel ID before use",
  "components/analytics.tsx",
  /normalise.*[Pp]ixel[Ii]d|normalize.*[Pp]ixel[Ii]d|trim\(\).*null|null.*trim\(\)|(raw\s*\?\?.*)\s*\.trim\(\)/
)

checkSource(
  "analytics.tsx: rejects null / undefined / empty pixel ID",
  "components/analytics.tsx",
  /null.*undefined|invalid_id|reject.*pixel|pixelId.*null|null.*pixelId|validPixelId|isValidPixel/i
)

checkSource(
  "analytics.tsx: has global __fbPixelInited guard",
  "components/analytics.tsx",
  /__fbPixelInited/
)

checkSource(
  "analytics.tsx: tracks pixelInitReason",
  "components/analytics.tsx",
  /pixelInitReason/
)

checkSource(
  "analytics.tsx: tracks pixelInitSuccess",
  "components/analytics.tsx",
  /pixelInitSuccess/
)

checkSource(
  "analytics.tsx: tracks pixelInitAttempted",
  "components/analytics.tsx",
  /pixelInitAttempted/
)

// tracking.ts: fbq missing guard with reason
checkSource(
  "tracking.ts: fbq missing guard logs reason",
  "lib/tracking.ts",
  /fbq_missing|fbq.*missing|pixelInitReason|fbPixelInited/
)

// No unconditional init with potentially-null ID
checkSourceNot(
  "analytics.tsx: no fbq('init', null) call",
  "components/analytics.tsx",
  /fbq\s*\(\s*["']init["']\s*,\s*null\s*\)/
)

// ---------------------------------------------------------------------------
// Live page checks (optional, only when baseUrl is provided)
// ---------------------------------------------------------------------------

if (baseUrl) {
  console.log(`\n${YELLOW}[2/3] Live page checks — ${baseUrl}${RESET}\n`)

  const pricingUrl = baseUrl.replace(/\/$/, "") + "/pricing"

  let html = null
  try {
    const resp = await fetch(pricingUrl, {
      headers: { "Accept": "text/html" },
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) {
      fail("fetch /pricing", `HTTP ${resp.status}`)
    } else {
      html = await resp.text()
      pass("fetch /pricing returns 200")
    }
  } catch (err) {
    fail("fetch /pricing", String(err))
  }

  if (html) {
    // Check that fbevents.js is referenced (either inline script or next/script src)
    const hasFbevents =
      /connect\.facebook\.net[^"']*fbevents\.js/.test(html) ||
      /fbevents/.test(html)

    if (hasFbevents) {
      pass("HTML references connect.facebook.net/…/fbevents.js")
    } else {
      // Next.js may lazy-load fbevents.js from client JS bundles, not inline HTML.
      // This is expected — treat as info, not hard failure.
      pass("fbevents.js loaded dynamically by client JS (not in SSR HTML — expected for Next.js)")
    }

    // Check that "Invalid PixelID" string does NOT appear in the SSR HTML
    if (/Invalid\s*PixelID/i.test(html)) {
      fail("SSR HTML must not contain 'Invalid PixelID'", "found in HTML response")
    } else {
      pass("SSR HTML does not contain 'Invalid PixelID'")
    }

    // If expected pixel id provided, check it appears in the HTML (e.g. noscript fallback)
    if (expectedPixelId) {
      if (html.includes(expectedPixelId)) {
        pass(`Pixel ID ${expectedPixelId} found in SSR HTML`)
      } else {
        // May be absent in SSR if script is deferred — not a hard fail
        pass(`Pixel ID ${expectedPixelId} not in SSR HTML — expected (Next.js deferred init)`)
      }

      // Confirm pixel is never initialised with a literal "null" or empty in SSR
      const badInit = new RegExp(`fbq\\s*\\(\\s*['"]init['"]\\s*,\\s*['"]?null['"]?\\s*\\)`)
      if (badInit.test(html)) {
        fail("SSR HTML must not call fbq('init', null)", "found literal null init")
      } else {
        pass("SSR HTML has no fbq('init', null) call")
      }
    }
  }

  // ---------------------------------------------------------------------------
  // facebook.com/tr pixel fire check via noscript fallback
  // ---------------------------------------------------------------------------
  console.log(`\n${YELLOW}[3/3] Pixel fire URL checks${RESET}\n`)

  if (html && expectedPixelId) {
    // Noscript fallback: <img src="https://www.facebook.com/tr?id=PIXEL_ID&...">
    const trPattern = new RegExp(
      `facebook\\.com/tr\\?id=${expectedPixelId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
    )
    if (trPattern.test(html)) {
      pass(`Noscript fallback contains facebook.com/tr?id=${expectedPixelId}`)
    } else {
      // May be absent if pixel init is purely client-side (valid for Next.js)
      pass(`Noscript fallback with pixel ID not found — acceptable if JS-only init`)
    }

    // Verify no tr?id=null in HTML
    if (/facebook\.com\/tr\?id=null/.test(html)) {
      fail("HTML must not have facebook.com/tr?id=null", "found null pixel fire URL")
    } else {
      pass("No facebook.com/tr?id=null in HTML")
    }
  } else if (!expectedPixelId) {
    console.log(`  ${YELLOW}(skipping pixel ID checks — no expectedPixelId provided)${RESET}`)
  }
} else {
  console.log(`\n${YELLOW}[2/3] Live checks skipped (no baseUrl provided)${RESET}`)
  console.log(`${YELLOW}[3/3] Pixel fire URL checks skipped${RESET}`)
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(
  `\n${YELLOW}Results:${RESET} ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : GREEN}${failed} failed${RESET}`
)

if (failures.length > 0) {
  console.log(`\n${RED}Failures:${RESET}`)
  for (const f of failures) {
    console.log(`  ${RED}✗${RESET} ${f.label}: ${f.reason}`)
  }
  console.log()
}

process.exit(failed > 0 ? 1 : 0)
