// Optional real service handshake check. Never prints keys, tokens or provider error bodies.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true, quiet: true });
const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/virgo-live.ts'), 'utf8');
const context = { exports: {}, process, fetch, AbortSignal, require: name => name === './env.js' ? { env: process.env } : { activeAIProvider: async () => null } };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
(async () => {
  const session = await context.exports.createVirgoLiveSession();
  const socket = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(session.token)}`);
  const timer = setTimeout(() => { console.error('VIRGO live handshake timed out'); socket.close(); process.exitCode = 1; }, 15000);
  socket.onopen = () => socket.send(JSON.stringify({ setup: session.setup }));
  socket.onmessage = async event => {
    const data = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
    if (data.setupComplete) { clearTimeout(timer); console.log('VIRGO live audio handshake passed (female voice, no microphone audio sent)'); socket.close(); }
    if (data.error) { clearTimeout(timer); console.error('VIRGO live setup unavailable'); socket.close(); process.exitCode = 1; }
  };
  socket.onerror = () => { clearTimeout(timer); console.error('VIRGO live connection unavailable'); process.exitCode = 1; };
  socket.onclose = () => clearTimeout(timer);
})().catch(() => { console.error('VIRGO live service could not be verified with the current environment configuration'); process.exitCode = 1; });
