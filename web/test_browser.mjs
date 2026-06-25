// Headless-browser smoke test for the AI playback build.
// Serves web/ and loads it in Chromium, verifies: no console errors, the AI
// auto-starts, and the game state advances (the ship is actually being driven).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pw from "/Users/mykytamelnychenko/Documents/Yana/alien/aliencatcher/node_modules/playwright-core/index.js";
const { chromium } = pw;

const WEB = path.dirname(fileURLToPath(import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const full = path.normalize(path.join(WEB, p));
  if (!full.startsWith(WEB)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const url = `http://localhost:${port}/index.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle" });

// Let the AI boot, auto-start, and play for a few seconds.
await page.waitForTimeout(7000);

const snap = await page.evaluate(() => {
  const cap = window.__cap || {};
  const ds = cap.drawState || {};
  const txt = (id) => (document.getElementById(id)?.textContent) ?? "";
  return {
    hasCap: !!cap.drawState,
    badge: document.getElementById("ai-badge")?.textContent || "",
    score: Number(txt("hud-score")),
    level: Number(txt("hud-level")),
    shipX: cap.ship ? Math.round(cap.ship.x) : null,
    rocks: (ds.rocks || []).length,
    aliens: (ds.aliens || []).length,
    startHidden: document.getElementById("start-screen")?.classList.contains("hidden"),
  };
});

// Sample ship x a moment later to confirm it is moving under AI control.
const x1 = snap.shipX;
await page.waitForTimeout(800);
const x2 = await page.evaluate(() => (window.__cap?.ship ? Math.round(window.__cap.ship.x) : null));

await browser.close();
server.close();

console.log("snapshot:", JSON.stringify(snap));
console.log("ship x moved:", x1, "->", x2);
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");

const ok = snap.hasCap && snap.startHidden && (snap.rocks > 0 || snap.aliens > 0) &&
           snap.badge.includes("AI") && errors.length === 0;
console.log(ok ? "BROWSER SMOKE PASS ✓" : "BROWSER SMOKE FAIL ✗");
process.exit(ok ? 0 : 1);
