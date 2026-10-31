const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function load(relative, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, require: name => { if (!(name in dependencies)) throw Error(`Unexpected import: ${name}`); return dependencies[name]; }, process: { env: {} }, AbortSignal, setTimeout, clearTimeout, ...globals };
  vm.runInNewContext(code, context);
  return context.exports;
}

test('live token is single use, constrained to female audio and short expiry; permanent key stays server side', async () => {
  let request;
  const env = { GEMINI_API_KEY: 'server-only-secret' };
  const mod = load('backend/src/lib/virgo-live.ts', {
    './env.js': { env }, '../admin/aiProviders.js': { activeAIProvider: async () => null },
  }, { fetch: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ name: 'auth_tokens/temporary' }) }; } });
  const result = await mod.createVirgoLiveSession({ products: [{ id: 'tee-1', name: 'Casual tee', price: 999, currency: 'INR', gender: 'MEN', type: 'tee', description: 'Cotton tee', colors: ['Black'], sizes: ['M'], stock: 4, images: ['/tee.jpg'] }], cart: [{ productId: 'tee-1', quantity: 1, size: 'M', color: 'Black' }] });
  const body = JSON.parse(request.options.body);
  assert.equal(body.uses, 1);
  assert.equal(body.bidiGenerateContentSetup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Aoede');
  assert.equal(body.bidiGenerateContentSetup.realtimeInputConfig.activityHandling, 'START_OF_ACTIVITY_INTERRUPTS');
  assert.ok(Date.parse(body.newSessionExpireTime) - Date.now() <= 60_000);
  assert.equal(request.options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
  assert.ok(!JSON.stringify(result).includes(env.GEMINI_API_KEY));
  assert.ok(body.bidiGenerateContentSetup.systemInstruction.parts[0].text.includes('Casual tee'));
  assert.ok(body.bidiGenerateContentSetup.systemInstruction.parts[0].text.includes('CURRENT CART'));
  assert.equal(body.bidiGenerateContentSetup.tools[0].functionDeclarations[0].name, 'show_products');
  assert.equal(result.products[0].url, '/product/tee-1');
  assert.ok(body.bidiGenerateContentSetup.sessionResumption);
  assert.ok(body.bidiGenerateContentSetup.contextWindowCompression.slidingWindow);
});

function reconnectHarness() {
  const sockets = [], requests = [], timers = new Map(), statuses = [], endings = [];
  let sequence = 0, microphoneOpens = 0, trackStops = 0, processor;
  class AudioContext {
    destination = {}; audioWorklet = { addModule: async () => {} };
    async resume() {} async close() {}
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  }
  class AudioWorkletNode { port = {}; constructor() { processor = this; } connect() {} disconnect() {} }
  class WebSocket {
    static OPEN = 1; readyState = 1; bufferedAmount = 0; sent = [];
    constructor() { sockets.push(this); }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.closed = true; }
  }
  const { VirgoLiveConversation } = load('frontend/lib/virgo-live.ts', { './api': { api: async (_path, options) => { requests.push(JSON.parse(options.body)); return { token: 'temporary', setup: { sessionResumption: {} } }; } } }, {
    window: { isSecureContext: true }, AudioContext, AudioWorkletNode, WebSocket, atob, btoa,
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id),
    navigator: { language: 'hi-IN', mediaDevices: { getUserMedia: async () => { microphoneOpens++; return { getTracks: () => [{ stop: () => trackStops++ }] }; } } },
  });
  const call = new VirgoLiveConversation({ speaking() {}, status: value => statuses.push(value), transcript() {}, ended: value => endings.push(value) });
  return { call, sockets, requests, statuses, endings, timers,
    microphoneOpens: () => microphoneOpens, trackStops: () => trackStops,
    emit: (socket, data) => socket.onmessage({ data: JSON.stringify(data) }),
    audio: () => processor.port.onmessage({ data: new Int16Array([500, -500]).buffer }),
    run: async delay => { const entry = [...timers].find(([, value]) => value.delay === delay); assert.ok(entry, `No timer for ${delay}`); timers.delete(entry[0]); entry[1].callback(); await new Promise(resolve => setImmediate(resolve)); },
  };
}

test('GoAway resumes with fresh credentials, keeps microphone, and does not greet twice', async () => {
  const h = reconnectHarness();
  await h.call.start([{ role: 'user', content: 'Namaste' }]);
  const first = h.sockets[0]; first.onopen();
  await h.emit(first, { setupComplete: {} });
  await h.emit(first, { sessionResumptionUpdate: { resumable: true, newHandle: 'resume-123' } });
  await h.emit(first, { goAway: { timeLeft: '3s' } });
  assert.equal(first.closed, undefined);
  h.audio(); assert.ok(first.sent.at(-1).realtimeInput.audio);
  await h.run(1500); await h.run(100);
  assert.equal(h.requests[1].resumeHandle, 'resume-123');
  assert.equal(h.requests[1].audience, 'customer');
  const second = h.sockets[1]; second.onopen();
  await h.emit(second, { setupComplete: {} });
  assert.equal(second.sent.length, 1); // setup only: no duplicate history or greeting
  assert.equal(h.microphoneOpens(), 1);
  assert.equal(h.endings.length, 0);
  h.audio(); assert.ok(second.sent.at(-1).realtimeInput.audio);
  h.call.stop(); assert.equal(h.trackStops(), 1); assert.equal(h.timers.size, 0);
});

test('network drop retries, fresh fallback restores transcript, stale sockets cannot interrupt', async () => {
  const h = reconnectHarness(); await h.call.start([]);
  const first = h.sockets[0]; first.onopen(); await h.emit(first, { setupComplete: {} });
  await h.emit(first, { serverContent: { inputTranscription: { text: 'My favourite colour is blue' }, turnComplete: true } });
  first.onclose({ code: 1006 }); await h.run(1000);
  const second = h.sockets[1]; second.onopen(); await h.emit(second, { setupComplete: {} });
  assert.ok(second.sent.some(message => message.clientContent?.turns[0]?.parts[0]?.text === 'My favourite colour is blue'));
  await h.emit(first, { error: { message: 'late event' } });
  assert.equal(second.closed, undefined);
  assert.equal(h.endings.length, 0); h.call.stop();
});

test('repeated failures end with a connection error and End cancels pending reconnect', async () => {
  const h = reconnectHarness(); await h.call.start([]);
  for (const delay of [1000, 2000, 4000]) {
    h.sockets.at(-1).onclose({ code: 1006 }); await h.run(delay);
  }
  h.sockets.at(-1).onclose({ code: 1006 });
  assert.equal(h.endings.length, 1);
  assert.ok(h.endings[0].includes('internet connection'));
  assert.equal(h.trackStops(), 1); assert.equal(h.timers.size, 0);
  const stopped = reconnectHarness(); await stopped.call.start([]);
  stopped.sockets[0].onclose({ code: 1006 }); stopped.call.stop();
  assert.equal(stopped.timers.size, 0); assert.equal(stopped.sockets.length, 1);
});

test('provider error details do not leave the token service', async () => {
  const mod = load('backend/src/lib/virgo-live.ts', {
    './env.js': { env: { GEMINI_API_KEY: 'secret' } }, '../admin/aiProviders.js': { activeAIProvider: async () => null },
  }, { fetch: async () => ({ ok: false, json: async () => ({ error: { message: 'private vendor billing details' } }) }) });
  await assert.rejects(mod.createVirgoLiveSession(), { message: 'VIRGO_VOICE_UNAVAILABLE' });
});

test('stopping during microphone permission releases tracks when permission resolves', async () => {
  let grant; let tracksStopped = 0; let apiCalls = 0;
  class AudioContext { async resume() {} async close() {} }
  const { VirgoLiveConversation } = load('frontend/lib/virgo-live.ts', { './api': { api: async () => { apiCalls++; } } }, {
    window: { isSecureContext: true }, AudioContext,
    navigator: { mediaDevices: { getUserMedia: () => new Promise(resolve => { grant = resolve; }) } },
  });
  const call = new VirgoLiveConversation({ speaking() {}, status() {}, transcript() {}, ended() {} });
  const pending = call.start([]);
  await new Promise(resolve => setImmediate(resolve));
  call.stop(); grant({ getTracks: () => [{ stop: () => tracksStopped++ }] });
  await pending;
  assert.equal(tracksStopped, 1); assert.equal(apiCalls, 0);
});

test('interruption clears scheduled audio immediately and stop closes microphone and socket', async () => {
  let socket; let stoppedTracks = 0; let stoppedPlayers = 0; let processor;
  const microphoneTrack = { enabled: true, stop: () => stoppedTracks++ };
  const transcripts = [];
  const displayedProducts = [];
  class AudioContext {
    currentTime = 1; destination = {}; audioWorklet = { addModule: async () => {} };
    async resume() {} async close() {}
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createBuffer(_channels, length) { return { duration: length / 24000, getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() {}, stop() { stoppedPlayers++; } }; }
  }
  class WebSocket {
    static OPEN = 1; readyState = 1; bufferedAmount = 0; sent = [];
    constructor() { socket = this; }
    send(message) { this.sent.push(JSON.parse(message)); }
    close() { this.closed = true; }
  }
  class AudioWorkletNode { port = {}; constructor() { processor = this; } connect() {} disconnect() {} }
  const { VirgoLiveConversation } = load('frontend/lib/virgo-live.ts', { './api': { api: async () => ({ token: 'temporary', setup: {}, products: [{ id: 'tee-1', name: 'Casual tee', stock: 4, price: 999 }, { id: 'sold-out', stock: 0 }] }) } }, {
    window: { isSecureContext: true }, AudioContext, AudioWorkletNode, WebSocket, atob, btoa,
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [microphoneTrack], getAudioTracks: () => [microphoneTrack] }) } },
  });
  const call = new VirgoLiveConversation({ speaking() {}, status() {}, transcript: (...args) => transcripts.push(args), products: (items, id) => displayedProducts.push({ items, id }), ended() {} });
  await call.start([{ role: 'user', content: 'Hello' }]);
  socket.onopen();
  await socket.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
  assert.ok(socket.sent.some(message => message.clientContent));
  await socket.onmessage({ data: JSON.stringify({ toolCall: { functionCalls: [{ id: 'call-1', name: 'show_products', args: { productIds: ['tee-1', 'made-up-id', 'sold-out', 'tee-1'] } }] } }) });
  assert.equal(displayedProducts.length, 1);
  assert.equal(displayedProducts[0].items.length, 1);
  assert.equal(displayedProducts[0].items[0].id, 'tee-1');
  assert.equal(socket.sent.at(-1).toolResponse.functionResponses[0].id, 'call-1');
  assert.equal(socket.sent.at(-1).toolResponse.functionResponses[0].response.displayed, true);
  await socket.onmessage({ data: JSON.stringify({ toolCall: { functionCalls: [{ id: 'call-2', name: 'show_products', args: { productIds: ['made-up-id'] } }] } }) });
  assert.equal(socket.sent.at(-1).toolResponse.functionResponses[0].response.displayed, false);
  await socket.onmessage({ data: JSON.stringify({ toolCall: { functionCalls: [{ id: 'call-3', name: 'checkout' }] } }) });
  assert.ok(socket.sent.at(-1).toolResponse.functionResponses[0].response.error);
  processor.port.onmessage({ data: new Int16Array([10, -10]).buffer });
  assert.equal(socket.sent.at(-1).realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
  call.setMuted(true);
  assert.equal(microphoneTrack.enabled, false);
  const mutedCount = socket.sent.length;
  processor.port.onmessage({ data: new Int16Array([10, -10]).buffer });
  assert.equal(socket.sent.length, mutedCount);
  call.setMuted(false);
  assert.equal(microphoneTrack.enabled, true);
  await socket.onmessage({ data: JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAAAAA==', mimeType: 'audio/pcm;rate=24000' } }] }, outputTranscription: { text: 'Hello!' } } }) });
  assert.equal(transcripts[0][1], 'Hello!');
  await socket.onmessage({ data: JSON.stringify({ serverContent: { interrupted: true } }) });
  assert.equal(stoppedPlayers, 1);
  call.stop(); assert.equal(stoppedTracks, 1); assert.equal(socket.closed, true);
});

test('microphone worklet produces 16 kHz PCM frames from 48 kHz input', () => {
  let Processor; const frames = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'frontend/public/virgo-microphone.js'), 'utf8'), {
    sampleRate: 48000,
    AudioWorkletProcessor: class { port = { postMessage: frame => frames.push(frame) }; },
    registerProcessor: (_name, implementation) => { Processor = implementation; },
  });
  const processor = new Processor();
  for (let i = 0; i < 24; i++) processor.process([[new Float32Array(128).fill(0.5)]]);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].byteLength, 2048);
  assert.equal(new Int16Array(frames[0])[0], 16384);
});
