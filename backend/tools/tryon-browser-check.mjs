import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const port = 9237;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "atelier-tryon-"));
const child = spawn(edge, ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1440,1000", "about:blank"], { stdio: "ignore" });
let socket;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  let target;
  for (let i = 0; i < 100; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === "page"); if (target) break; } catch {}
    await wait(100);
  }
  if (!target) throw new Error("Edge did not start");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener("message", (event) => { const msg = JSON.parse(event.data); if (msg.method === "Runtime.exceptionThrown") exceptions.push(msg.params.exceptionDetails?.text || "runtime exception"); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); } });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const commandId = ++id; pending.set(commandId, { resolve, reject }); socket.send(JSON.stringify({ id: commandId, method, params })); });
  const evaluate = async (expression) => (await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  await command("Page.enable"); await command("Runtime.enable"); await command("Page.navigate", { url: "http://localhost:3000/" });
  for (let i = 0; i < 150; i++) { if (await evaluate("document.querySelectorAll('.cin-3d-card').length === 3 && document.querySelectorAll('.cin-look').length > 0")) break; await wait(200); }
  const initial = await evaluate("({cards:document.querySelectorAll('.cin-3d-card').length, lookbook3d:!!document.querySelector('#lookbook .cin-3d-edit'), filmNext:!!document.querySelector('#film')?.nextElementSibling?.querySelector('.cin-3d-edit'),loadedGlbs:performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.glb')).length})");
  if (initial.cards !== 3 || initial.lookbook3d || !initial.filmNext || initial.loadedGlbs > 1) throw new Error(`3D placement/lazy-loading invalid: ${JSON.stringify(initial)}`);
  await evaluate("document.querySelector('.cin-3d-card button')?.click()");
  for (let i = 0; i < 30; i++) { if (await evaluate("!!document.querySelector('.cin-3d-dialog')")) break; await wait(100); }
  for (let i = 0; i < 100; i++) { const settled = await evaluate("document.querySelector('.cin-3d-dialog .cin-3d-viewer')?.getAttribute('aria-busy') === 'false' || !!document.querySelector('.cin-3d-error')"); if (settled) break; await wait(200); }
  const dialog = await evaluate("({open:!!document.querySelector('.cin-3d-dialog'), products:document.querySelectorAll('.cin-tryon-products button').length, title:document.querySelector('.cin-3d-dialog-title')?.textContent, canvas:!!document.querySelector('.cin-3d-dialog canvas'),busy:document.querySelector('.cin-3d-dialog .cin-3d-viewer')?.getAttribute('aria-busy'),captureBytes:Math.floor((document.querySelector('.cin-3d-dialog canvas')?.toDataURL('image/jpeg',0.9).length||0)*0.75)})");
  if (!dialog.open || dialog.products < 1 || dialog.busy !== "false" || dialog.captureBytes < 10000) throw new Error(`Try-on dialog/model capture failed: ${JSON.stringify(dialog)}`);
  await evaluate("document.querySelector('.cin-tryon-products button')?.click()");
  const selected = await evaluate("({selected:document.querySelectorAll('.cin-tryon-products button.selected').length, count:document.querySelector('.cin-tryon-head span')?.textContent, action:document.querySelector('.cin-tryon-submit')?.textContent.trim()})");
  if (selected.selected !== 1 || selected.count !== "1/5 selected" || selected.action !== "Sign in to try on") throw new Error(`Product selection/auth gating failed: ${JSON.stringify(selected)}`);
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait(500);
  const mobile = await evaluate("(()=>{const d=document.querySelector('.cin-3d-dialog');const r=d.getBoundingClientRect();return {width:innerWidth,height:innerHeight,top:r.top,bottom:r.bottom,scrollHeight:d.scrollHeight,clientHeight:d.clientHeight,selected:document.querySelectorAll('.cin-tryon-products button.selected').length}})()");
  if (mobile.top < 0 || mobile.bottom > mobile.height + 1 || mobile.selected !== 1) throw new Error(`Mobile try-on dialog layout failed: ${JSON.stringify(mobile)}`);
  const shot = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
  fs.writeFileSync(path.resolve("browser-qa-results/tryon-mobile.png"), Buffer.from(shot.data, "base64"));
  await command("Page.navigate", { url: "http://localhost:3000/login" });
  await wait(1800);
  const login = await evaluate("({url:location.pathname,auth:!!document.querySelector('.auth'),panel:!!document.querySelector('.auth-panel'),panelDisplay:document.querySelector('.auth-panel')?getComputedStyle(document.querySelector('.auth-panel')).display:null,inputs:[...document.querySelectorAll('.auth-panel input')].map(x=>({type:x.type,display:getComputedStyle(x).display})),bodyText:document.body.innerText.slice(0,700)})");
  if (exceptions.length) throw new Error(`Browser runtime exceptions: ${exceptions.join(" | ")}`);
  console.log(JSON.stringify({ result: "PASS", placement: initial, dialog, selection: selected, mobile, login, exceptions }));
} finally {
  try { socket?.close(); } catch {}
  child.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
