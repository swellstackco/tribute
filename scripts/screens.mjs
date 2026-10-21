// Muted headless run through the main screens. Saves screenshots and checks the T9 done criteria.
// Usage: node scripts/screens.mjs [baseUrl] [outDir]
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:5117";
const out = process.argv[3] ?? "docs/assets";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--mute-audio", "--autoplay-policy=document-user-activation-required"] });
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails.push(msg); };
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

for (const [label, width, height] of [["desktop", 1280, 900], ["mobile", 375, 800]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: label === "mobile" ? 2 : 1 });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForSelector(".example");
  check(await noHScroll(page), `${label}: landing has no horizontal scroll`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/landing-${label}.png`, fullPage: true });

  const t0 = Date.now();
  await page.locator(".example").first().getByRole("link").click();
  await page.waitForSelector(".pick");
  check(Date.now() - t0 < 1000, `${label}: example opens in under 1 s (${Date.now() - t0} ms)`);
  check(await noHScroll(page), `${label}: plan page has no horizontal scroll`);
  const sections = await page.locator(".sec").count();
  check(sections === 6, `${label}: six sections (${sections})`);
  const cards = await page.locator(".pick").count();
  const because = await page.locator(".pick .because").count();
  const fits = await page.locator(".pick .fit").count();
  check(because === cards, `${label}: every card has a Because line (${because}/${cards})`);
  check(fits === cards, `${label}: every card has a fit number (${fits}/${cards})`);
  for (const id of ["music", "readings", "food", "venue", "screen"]) {
    const n = await page.locator(`#s-${id} .unmentioned`).count();
    check(n >= 1, `${label}: ${id} has an unmentioned mark (${n})`);
  }
  await page.screenshot({ path: `${out}/program-${label}.png`, fullPage: true });
  if (label === "desktop") {
    await page.screenshot({ path: `${out}/program.png`, fullPage: false });
    await page.getByRole("link", { name: "See why we chose these" }).click();
    await page.waitForSelector(".ev");
    await page.screenshot({ path: `${out}/why-${label}.png`, fullPage: true });
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: `${out}/why-print.pdf`, preferCSSPageSize: true });
    await page.emulateMedia({ media: "screen" });
    await page.goBack();
    await page.waitForSelector(".pick");
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: `${out}/program-print.pdf`, preferCSSPageSize: true });
    await page.emulateMedia({ media: "screen" });
  } else {
    await page.getByRole("link", { name: "See why we chose these" }).click();
    await page.waitForSelector(".ev");
    check(await noHScroll(page), `${label}: why page has no horizontal scroll`);
    await page.screenshot({ path: `${out}/why-${label}.png`, fullPage: true });
  }

  // Start your own, with an ambiguous love.
  await page.goto(`${base}/#/new`);
  await page.waitForSelector(".chip");
  check(await noHScroll(page), `${label}: intake has no horizontal scroll`);
  const loves = ["Ghost", "Merle Haggard", "Johnny Cash", "carne asada", "bass fishing"];
  for (let i = 0; i < loves.length; i++) await page.locator(".chip").nth(i).fill(loves[i]);
  await page.fill("#fname", "Sam" + label + Date.now() % 1000);
  await page.fill("#city", "Bakersfield, CA");
  await page.screenshot({ path: `${out}/intake-${label}.png`, fullPage: true });
  await page.getByRole("button", { name: "Build the tribute" }).click();
  await page.waitForSelector(".question");
  await page.waitForTimeout(400);
  check(await noHScroll(page), `${label}: ledger has no horizontal scroll`);
  await page.screenshot({ path: `${out}/ledger-${label}.png`, fullPage: true });
  if (label === "desktop") await page.screenshot({ path: `${out}/ledger.png` });
  await page.locator(".question .btn").nth(1).click();
  await page.waitForSelector(".pick", { timeout: 8000 });
  check(true, `${label}: ledger resumed and landed on the plan`);
  await ctx.close();
}
await browser.close();
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
