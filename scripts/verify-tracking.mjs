import { chromium } from "playwright";

const targetUrl = process.argv[2] || "https://www.turbotaai.com";
const secondUrl = new URL("/about", targetUrl).toString();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const hits = { ga: 0, fb: 0, fbjs: 0, failed: [] };

const isGa = (u) => u.includes("google-analytics.com/g/collect");
const isFb = (u) => u.includes("facebook.com/tr?");
const isFbJs = (u) => u.includes("connect.facebook.net") && u.includes("fbevents.js");

page.on("request", (req) => {
  const u = req.url();
  if (isGa(u)) hits.ga += 1;
  if (isFb(u)) hits.fb += 1;
  if (isFbJs(u)) hits.fbjs += 1;
});

page.on("requestfailed", (req) => {
  const u = req.url();
  if (isGa(u) || isFb(u) || isFbJs(u)) {
    hits.failed.push({ url: u, error: req.failure()?.errorText || "unknown" });
  }
});

await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

const debug1 = await page.evaluate(() => {
  const d = window.__trackingDebug;
  return d ? { gaLoaded: !!d.gaLoaded, fbLoaded: !!d.fbLoaded } : null;
});

await page.goto(secondUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);

const debug2 = await page.evaluate(() => {
  const d = window.__trackingDebug;
  return d ? { gaLoaded: !!d.gaLoaded, fbLoaded: !!d.fbLoaded } : null;
});

await browser.close();

const result = { url: targetUrl, debug1, debug2, hits };
console.log(JSON.stringify(result, null, 2));

let exitCode = 0;
if (!debug1?.gaLoaded) exitCode = 11;
if (!debug1?.fbLoaded) exitCode = 12;
if (hits.ga === 0) exitCode = 13;
if (hits.fb === 0) exitCode = 14;

if (exitCode) {
  console.error("FAIL: tracking check failed");
  process.exit(exitCode);
}
console.log("OK: GA + Meta Pixel active");
