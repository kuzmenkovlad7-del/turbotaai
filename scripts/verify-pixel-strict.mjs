import { chromium } from "playwright"

const baseUrlArg = process.argv[2]
const expectedPixelId = process.argv[3]

if (!baseUrlArg || !expectedPixelId) {
  console.error("Usage: node scripts/verify-pixel-strict.mjs <baseUrl> <expectedPixelId>")
  process.exit(2)
}

const baseUrl = String(baseUrlArg).trim().replace(/\/$/, "")
const pricingUrl = `${baseUrl}/pricing`

const result = {
  baseUrl,
  pricingUrl,
  expectedPixelId,
  requests: {
    fbeventsJs: 0,
    fbTr: 0,
  },
  trIds: [],
  console: {
    invalidPixelNullSeen: false,
    matchedMessages: [],
  },
  debug: null,
  checks: {
    fbeventsLoaded: false,
    trRequestSeen: false,
    expectedPixelSeen: false,
    invalidPixelNullAbsent: false,
  },
  reasons: [],
}

const trIds = new Set()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

page.on("request", (req) => {
  const u = req.url()

  if (u.includes("connect.facebook.net") && u.includes("fbevents.js")) {
    result.requests.fbeventsJs += 1
  }

  if (u.includes("facebook.com/tr")) {
    result.requests.fbTr += 1
    try {
      const id = new URL(u).searchParams.get("id")
      if (id) trIds.add(id)
    } catch {}
  }
})

page.on("console", (msg) => {
  const text = msg.text()
  if (/Invalid PixelID:\s*null/i.test(text)) {
    result.console.invalidPixelNullSeen = true
    result.console.matchedMessages.push(text)
  }
})

try {
  await page.goto(pricingUrl, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(3500)

  result.debug = await page.evaluate(() => {
    // @ts-ignore
    return typeof window !== "undefined" ? (window.__trackingDebug ?? null) : null
  })
} catch (e) {
  result.reasons.push(`navigation_failed: ${String(e?.message || e)}`)
} finally {
  result.trIds = [...trIds]
  await browser.close()
}

result.checks.fbeventsLoaded = result.requests.fbeventsJs > 0
result.checks.trRequestSeen = result.requests.fbTr > 0
result.checks.expectedPixelSeen = result.trIds.includes(expectedPixelId)
result.checks.invalidPixelNullAbsent = !result.console.invalidPixelNullSeen

if (!result.checks.fbeventsLoaded) result.reasons.push("fbevents.js_not_loaded")
if (!result.checks.trRequestSeen) result.reasons.push("facebook_tr_not_seen")
if (!result.checks.expectedPixelSeen) result.reasons.push("expected_pixel_id_not_found_in_tr_requests")
if (!result.checks.invalidPixelNullAbsent) result.reasons.push("console_contains_Invalid_PixelID_null")

console.log(JSON.stringify(result, null, 2))

if (result.reasons.length > 0) {
  console.error("FAIL: Meta Pixel strict verification failed")
  process.exit(1)
}

console.log("OK: Meta Pixel strict verification passed")
