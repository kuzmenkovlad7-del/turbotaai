#!/usr/bin/env node
/**
 * verify-pixel-strict.mjs
 *
 * Playwright-based verification of Meta Pixel integration.
 * Opens /pricing in a real browser, collects network requests and console
 * logs, then validates pixel initialisation and tracking fire.
 *
 * Usage:
 *   node scripts/verify-pixel-strict.mjs <baseUrl> <expectedPixelId>
 *
 * Example:
 *   node scripts/verify-pixel-strict.mjs https://www.turbotaai.com 1231870625080038
 *
 * Exit 0  => OK   (all checks passed)
 * Exit 1  => FAIL (one or more checks failed, reasons printed)
 */

// Playwright may be installed globally (e.g. /opt/node22/lib/node_modules).
// Use createRequire to resolve it from either local or global node_modules.
import { createRequire } from "node:module"

let chromium
try {
  // Try local first
  ;({ chromium } = await import("playwright"))
} catch {
  // Fall back to global installation
  const globalRoot = "/opt/node22/lib/node_modules"
  const require = createRequire(globalRoot + "/playwright/index.js")
  ;({ chromium } = require("."))
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const [, , rawBaseUrl, expectedPixelId] = process.argv

if (!rawBaseUrl || !expectedPixelId) {
  console.error(
    "Usage: node scripts/verify-pixel-strict.mjs <baseUrl> <expectedPixelId>"
  )
  process.exit(2)
}

const baseUrl = rawBaseUrl.replace(/\/$/, "")

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RESET = "\x1b[0m"

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const failures = []

function pass(label) {
  console.log(`${GREEN}PASS${RESET} ${label}`)
  passed++
}

function fail(label, reason) {
  console.log(`${RED}FAIL${RESET} ${label} — ${reason}`)
  failures.push({ label, reason })
  failed++
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`\n${YELLOW}=== Meta Pixel Strict Verification (Playwright) ===${RESET}`)
console.log(`  baseUrl:         ${baseUrl}`)
console.log(`  expectedPixelId: ${expectedPixelId}\n`)

const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  })

  const page = await context.newPage()

  // -------------------------------------------------------------------------
  // Collectors
  // -------------------------------------------------------------------------

  /** URLs that loaded fbevents.js */
  const fbeventsRequests = []

  /** URLs matching facebook.com/tr (pixel fire requests) */
  const trRequests = []

  /** All console messages */
  const consoleLogs = []

  page.on("request", (req) => {
    const url = req.url()
    if (/connect\.facebook\.net\/.*fbevents\.js/.test(url)) {
      fbeventsRequests.push(url)
    }
    if (/facebook\.com\/tr\b/.test(url)) {
      trRequests.push(url)
    }
  })

  page.on("console", (msg) => {
    let location = null
    try {
      const loc = msg.location()
      if (loc && (loc.url || loc.lineNumber != null)) {
        location = { url: loc.url ?? null, lineNumber: loc.lineNumber ?? null }
      }
    } catch {
      // location() may throw in some Playwright versions — ignore
    }
    consoleLogs.push({ type: msg.type(), text: msg.text(), location })
  })

  // -------------------------------------------------------------------------
  // Navigate to /pricing
  // -------------------------------------------------------------------------

  const pricingUrl = `${baseUrl}/pricing`
  console.log(`${YELLOW}[1/4] Opening ${pricingUrl}${RESET}\n`)

  let loadOk = false
  try {
    const response = await page.goto(pricingUrl, {
      waitUntil: "networkidle",
      timeout: 30_000,
    })
    if (response && response.ok()) {
      pass(`GET /pricing returned ${response.status()}`)
      loadOk = true
    } else {
      fail("GET /pricing", `HTTP ${response?.status() ?? "no response"}`)
    }
  } catch (err) {
    fail("GET /pricing", String(err))
  }

  // Give pixel a moment to fire after networkidle
  if (loadOk) {
    await page.waitForTimeout(2000)
  }

  // -------------------------------------------------------------------------
  // Check 1: fbevents.js loaded
  // -------------------------------------------------------------------------

  console.log(`\n${YELLOW}[2/4] Network request checks${RESET}\n`)

  if (fbeventsRequests.length > 0) {
    pass(
      `fbevents.js loaded (${fbeventsRequests.length} request${fbeventsRequests.length > 1 ? "s" : ""})`
    )
  } else {
    fail("fbevents.js load", "no request to connect.facebook.net/*/fbevents.js detected")
  }

  // -------------------------------------------------------------------------
  // Check 2: facebook.com/tr fired with expected pixel ID
  // -------------------------------------------------------------------------

  if (trRequests.length > 0) {
    pass(
      `facebook.com/tr fired (${trRequests.length} request${trRequests.length > 1 ? "s" : ""})`
    )

    // Extract id= from each tr URL and check expectedPixelId exists
    const escapedId = expectedPixelId.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    )
    const idPattern = new RegExp(`[?&]id=${escapedId}(?:&|$)`)

    const hasCorrectId = trRequests.some((url) => idPattern.test(url))
    if (hasCorrectId) {
      pass(`tr?id contains expected pixel ID ${expectedPixelId}`)
    } else {
      fail(
        `tr?id contains expected pixel ID`,
        `none of the ${trRequests.length} tr requests contain id=${expectedPixelId}`
      )
    }

    // Check none have id=null
    const hasNullId = trRequests.some((url) => /[?&]id=null(?:&|$)/.test(url))
    if (!hasNullId) {
      pass("no tr request has id=null")
    } else {
      fail("tr?id=null check", "found facebook.com/tr request with id=null")
    }
  } else {
    fail("facebook.com/tr fire", "no request to facebook.com/tr detected")
  }

  // -------------------------------------------------------------------------
  // Check 3: Console must NOT contain "Invalid PixelID: null"
  // -------------------------------------------------------------------------

  console.log(`\n${YELLOW}[3/4] Console log checks${RESET}\n`)

  const invalidPixelLogs = consoleLogs.filter((l) =>
    /Invalid\s*PixelID.*null/i.test(l.text)
  )
  if (invalidPixelLogs.length === 0) {
    pass('console has no "Invalid PixelID: null" messages')
  } else {
    const details = invalidPixelLogs
      .map((l) => {
        let info = l.text
        if (l.location?.url) {
          info += ` (source: ${l.location.url}:${l.location.lineNumber ?? "?"})`
        }
        return info
      })
      .join(" | ")
    fail(
      '"Invalid PixelID: null" in console',
      `found ${invalidPixelLogs.length} occurrence(s): ${details}`
    )
  }

  // Also flag any Meta Pixel error console messages
  const metaPixelErrors = consoleLogs.filter(
    (l) =>
      l.type === "error" &&
      /meta\s*pixel|fbq|facebook/i.test(l.text)
  )
  if (metaPixelErrors.length === 0) {
    pass("no Meta Pixel console errors")
  } else {
    // Warn but don't hard-fail for generic pixel errors (e.g. network issues)
    console.log(
      `  ${YELLOW}WARN${RESET} ${metaPixelErrors.length} Meta Pixel console error(s) detected (not a hard failure)`
    )
    for (const e of metaPixelErrors) {
      console.log(`    ${e.text.slice(0, 200)}`)
    }
  }

  // -------------------------------------------------------------------------
  // Check 4: __trackingDebug is populated
  // -------------------------------------------------------------------------

  console.log(`\n${YELLOW}[4/4] __trackingDebug diagnostics${RESET}\n`)

  let debugObj = null
  try {
    debugObj = await page.evaluate(() => (window).__trackingDebug)
  } catch {
    // ignore
  }

  if (debugObj) {
    pass("window.__trackingDebug is populated")

    if (debugObj.pixelInitAttempted === true) {
      pass("pixelInitAttempted = true")
    } else {
      fail("pixelInitAttempted", `expected true, got ${debugObj.pixelInitAttempted}`)
    }

    if (debugObj.pixelInitSuccess === true) {
      pass("pixelInitSuccess = true")
    } else {
      fail("pixelInitSuccess", `expected true, got ${debugObj.pixelInitSuccess}`)
    }

    if (debugObj.pixelInitReason === "ok") {
      pass('pixelInitReason = "ok"')
    } else {
      fail("pixelInitReason", `expected "ok", got "${debugObj.pixelInitReason}"`)
    }

    if (debugObj.pixelIdMasked && debugObj.pixelIdMasked !== "(none)") {
      pass(`pixelIdMasked = "${debugObj.pixelIdMasked}"`)
    } else {
      fail("pixelIdMasked", `expected a masked ID, got "${debugObj.pixelIdMasked}"`)
    }
  } else {
    fail("window.__trackingDebug", "not found on page")
  }

  // -------------------------------------------------------------------------
  // Structured JSON result
  // -------------------------------------------------------------------------

  const result = {
    url: pricingUrl,
    expectedPixelId,
    fbeventsLoaded: fbeventsRequests.length > 0,
    trRequestCount: trRequests.length,
    trUrls: trRequests,
    invalidPixelIdConsole: invalidPixelLogs.length,
    invalidPixelIdSources: invalidPixelLogs.map((l) => ({
      text: l.text,
      sourceUrl: l.location?.url ?? null,
      lineNumber: l.location?.lineNumber ?? null,
    })),
    trackingDebug: debugObj,
    passed,
    failed,
    failures,
  }

  console.log(`\n${YELLOW}--- Structured Result ---${RESET}`)
  console.log(JSON.stringify(result, null, 2))

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  console.log(
    `\n${YELLOW}Results:${RESET} ${GREEN}${passed} passed${RESET}, ${
      failed > 0 ? RED : GREEN
    }${failed} failed${RESET}`
  )

  if (failures.length > 0) {
    console.log(`\n${RED}FAIL${RESET} — reasons:`)
    for (const f of failures) {
      console.log(`  ${RED}✗${RESET} ${f.label}: ${f.reason}`)
    }
    console.log()
  } else {
    console.log(`\n${GREEN}OK${RESET}\n`)
  }
} finally {
  await browser.close()
}

process.exit(failed > 0 ? 1 : 0)
