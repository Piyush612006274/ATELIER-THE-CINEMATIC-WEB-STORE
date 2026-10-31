import { api } from './api';

export type VirgoProduct = { id: string; name: string; price: number; currency: string; stock: number; url: string; image: string };

type Callbacks = {
  status: (value: string) => void;
  speaking: (value: boolean) => void;
  transcript: (role: 'user' | 'assistant', text: string, id: string) => void;
  ended: (message?: string) => void;
  products?: (products: VirgoProduct[], id: string) => void;
  level?: (value: number) => void;
};

export class VirgoLiveConversation {
  private socket?: WebSocket;
  private context?: AudioContext;
  private microphone?: MediaStream;
  private processor?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private players = new Set<AudioBufferSourceNode>();
  private nextAudio = 0;
  private stopped = false;
  private ready = false;
  private muted = false;
  private timer?: ReturnType<typeof setTimeout>;
  private rotationTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private resumeHandle?: string;
  private reconnecting = false;
  private failures = 0;
  private generation = 0;
  private history: Array<{ role: string; content: string; id?: string }> = [];
  private analyser?: AnalyserNode;
  private animation?: number;
  private inputLevel = 0;
  private turn = 0;
  private session = Date.now();
  constructor(private callbacks: Callbacks, private audience: 'customer' | 'admin' = 'customer', private developmentInstructions = '') {}

  async start(history: Array<{ role: string; content: string }>) {
    this.history = history.slice(-12);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) throw new Error();
      this.context = new AudioContext();
      await this.context.resume();
      this.microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (this.stopped) { this.stop(); return; }
      if (this.muted) this.microphone.getAudioTracks().forEach(track => { track.enabled = false; });
      await this.context.audioWorklet.addModule('/virgo-microphone.js');
      if (this.stopped) return;
      this.connectMicrophone();
      if (typeof this.context.createAnalyser === 'function') {
        this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256;
        this.analyser.connect(this.context.destination);
        this.animateLevel();
      }
      await this.openConnection(false);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      this.fail(/NotAllowed|PermissionDenied/.test(name) ? 'Microphone access was denied. Allow microphone access in your browser, then start voice again.' : /NotFound|NotReadable/.test(name) ? 'Your microphone is unavailable or in use by another app. Check your device and try again.' : 'VIRGO could not start voice. Check your microphone and connection, then try again.');
    }
  }

  private async openConnection(reconnecting: boolean) {
    const generation = ++this.generation;
    try {
      const session = await api<{ token: string; setup: Record<string, unknown>; products?: VirgoProduct[] }>('/ai/voice/session', { method: 'POST', body: JSON.stringify({ resumeHandle: this.resumeHandle, audience: this.audience, developmentInstructions: this.developmentInstructions }) });
      if (this.stopped) return;
      if (generation !== this.generation) return;
      this.socket = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(session.token)}`);
      const socket = this.socket;
      this.socket.binaryType = 'arraybuffer';
      this.timer = setTimeout(() => this.recover(), 15_000);
      this.socket.onopen = () => { if (!this.stopped && generation === this.generation) this.send({ setup: session.setup }); };
      this.socket.onmessage = async event => {
        try {
          const data = JSON.parse(typeof event.data === 'string' ? event.data : event.data instanceof ArrayBuffer ? new TextDecoder().decode(event.data) : await event.data.text());
          if (this.stopped || generation !== this.generation) return;
          if (data.error) { this.recover(); return; }
          if (data.sessionResumptionUpdate) {
            const update = data.sessionResumptionUpdate;
            this.resumeHandle = update.resumable && update.newHandle ? update.newHandle : undefined;
          }
          if (data.goAway) {
            const remaining = Number.parseFloat(String(data.goAway.timeLeft || '5s')) * 1000;
            clearTimeout(this.rotationTimer);
            this.rotationTimer = setTimeout(() => this.recover(true), Math.max(0, (Number.isFinite(remaining) ? remaining : 5000) - 1500));
          }
          if (data.setupComplete) {
            clearTimeout(this.timer);
            this.ready = true;
            this.reconnecting = false;
            clearTimeout(this.rotationTimer);
            this.rotationTimer = setTimeout(() => this.recover(true), 12 * 60_000);
            if (!this.resumeHandle && this.history.length) this.send({ clientContent: { turns: this.history.slice(-12).filter(m => m.content).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 4000) }] })), turnComplete: false } });
            this.callbacks.status(this.muted ? 'Microphone muted' : reconnecting ? 'Reconnected · Listening…' : 'Listening… Speak in your preferred language');
            if (!reconnecting) this.send({ realtimeInput: { text: `Begin this new voice call with a brief warm greeting using the authenticated person's name if supplied. Use the language of the latest user message in the conversation; if there is none, use this browser language hint: ${navigator.language || 'en'}. Ask how you can help, without repeating or answering an old request. Then listen.` } });
          }
          if (data.toolCall?.functionCalls) {
            const functionResponses = data.toolCall.functionCalls.map((call: { id: string; name: string; args?: { productIds?: unknown } }) => {
              if (call.name !== 'show_products') return { id: call.id, name: call.name, response: { error: 'This action is not available.' } };
              const ids = Array.isArray(call.args?.productIds) ? call.args.productIds.filter((id: unknown): id is string => typeof id === 'string') : [];
              const chosen = [...new Set(ids)].map(id => session.products?.find(product => product.id === id && product.stock > 0)).filter((product): product is VirgoProduct => Boolean(product)).slice(0, 3);
              const displayed = Boolean(chosen.length && this.callbacks.products);
              if (displayed) this.callbacks.products!(chosen, `voice-${this.session}-${this.turn}-assistant`);
              return { id: call.id, name: call.name, response: displayed ? { displayed: true, products: chosen } : { displayed: false, error: 'No matching in-stock products could be displayed. Offer another catalogue option.' } };
            });
            this.send({ toolResponse: { functionResponses } });
          }
          const content = data.serverContent;
          if (!content) return;
          if (content.interrupted) { this.clearAudio(); this.turn++; this.callbacks.status('Listening…'); }
          for (const part of content.modelTurn?.parts || []) if (part.inlineData?.data) this.play(part.inlineData.data, part.inlineData.mimeType);
          if (content.inputTranscription?.text) this.transcript('user', content.inputTranscription.text);
          if (content.outputTranscription?.text) this.transcript('assistant', content.outputTranscription.text);
          if (content.turnComplete) { this.failures = 0; this.turn++; if (!this.players.size) this.callbacks.status(this.muted ? 'Microphone muted' : 'Listening…'); }
        } catch { if (generation === this.generation) this.recover(); }
      };
      socket.onerror = () => { if (generation === this.generation) this.recover(); };
      socket.onclose = event => {
        if (this.stopped || generation !== this.generation) return;
        if (event.code === 1008) this.resumeHandle = undefined;
        this.recover();
      };
    } catch { if (generation === this.generation) this.recover(); }
  }

  private transcript(role: 'user' | 'assistant', text: string) {
    const id = `voice-${this.session}-${this.turn}-${role}`;
    const message = this.history.find(item => item.id === id);
    if (message) message.content = (message.content + text).slice(-4000);
    else this.history.push({ id, role, content: text.slice(-4000) });
    this.history = this.history.slice(-12);
    this.callbacks.transcript(role, text, id);
  }

  private recover(planned = false) {
    if (this.stopped || this.reconnecting) return;
    if (!planned && ++this.failures > 3) { this.fail(); return; }
    this.reconnecting = true; this.ready = false; ++this.generation;
    clearTimeout(this.timer); clearTimeout(this.rotationTimer); clearTimeout(this.retryTimer);
    this.socket?.close(); this.clearAudio(); this.turn++;
    this.callbacks.status('Reconnecting to VIRGO… Please pause for a moment');
    // A failed resume may be retried using the recent transcript with fresh credentials.
    if (this.failures >= 2) this.resumeHandle = undefined;
    this.retryTimer = setTimeout(() => { this.reconnecting = false; void this.openConnection(true); }, planned ? 100 : Math.min(4000, 500 * 2 ** this.failures));
  }

  private animateLevel() {
    if (this.stopped || typeof requestAnimationFrame !== 'function') return;
    const samples = new Uint8Array(this.analyser?.fftSize || 256);
    const tick = () => {
      if (this.stopped) return;
      this.analyser?.getByteTimeDomainData(samples);
      let energy = 0;
      if (this.analyser) for (const value of samples) energy += ((value - 128) / 128) ** 2;
      this.callbacks.level?.(Math.min(1, Math.max(this.muted || !this.ready ? 0 : this.inputLevel, Math.sqrt(energy / samples.length)) * 4));
      this.animation = requestAnimationFrame(tick);
    };
    this.animation = requestAnimationFrame(tick);
  }

  private send(message: unknown) {
    if (!this.stopped && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  private connectMicrophone() {
    if (!this.context || !this.microphone || this.stopped) return;
    this.source = this.context.createMediaStreamSource(this.microphone);
    this.processor = new AudioWorkletNode(this.context, 'virgo-microphone');
    this.processor.port.onmessage = event => {
      const pcm = new Int16Array(event.data);
      let energy = 0;
      for (const sample of pcm) energy += (sample / 32768) ** 2;
      this.inputLevel = Math.sqrt(energy / Math.max(1, pcm.length));
      if (!this.ready || this.stopped || this.muted || (this.socket?.bufferedAmount || 0) > 64000) return;
      const bytes = new Uint8Array(event.data);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      this.send({ realtimeInput: { audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' } } });
    };
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }
  private play(encoded: string, mime: string) {
    if (!this.context || this.stopped) return;
    const binary = atob(encoded);
    const pcm = new DataView(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) pcm.setUint8(i, binary.charCodeAt(i));
    const rate = Number(/rate=(\d+)/.exec(mime || '')?.[1] || 24000);
    const buffer = this.context.createBuffer(1, Math.floor(binary.length / 2), rate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = pcm.getInt16(i * 2, true) / 32768;
    const player = this.context.createBufferSource();
    player.buffer = buffer; player.connect(this.analyser || this.context.destination);
    this.nextAudio = Math.max(this.context.currentTime + 0.015, this.nextAudio);
    player.start(this.nextAudio); this.nextAudio += buffer.duration;
    this.players.add(player); this.callbacks.speaking(true); this.callbacks.status('VIRGO is speaking · You can interrupt');
    player.onended = () => { this.players.delete(player); player.disconnect(); if (!this.players.size && !this.stopped) { this.callbacks.speaking(false); if (this.ready) this.callbacks.status(this.muted ? 'Microphone muted' : 'Listening…'); } };
  }
  private clearAudio() {
    for (const player of this.players) { player.onended = null; try { player.stop(); } catch {} player.disconnect(); }
    this.players.clear(); this.nextAudio = 0; this.callbacks.speaking(false);
  }
  private fail(message = 'VIRGO could not reconnect to the voice service. Please check your internet connection and start voice again. Your chat is saved.') {
    if (this.stopped) return;
    this.stop();
    this.callbacks.ended(message);
  }
  stop() {
    this.stopped = true; this.ready = false; clearTimeout(this.timer);
    ++this.generation; clearTimeout(this.rotationTimer); clearTimeout(this.retryTimer);
    if (this.animation !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.animation);
    this.analyser?.disconnect(); this.callbacks.level?.(0);
    this.socket?.close(); this.processor?.disconnect(); this.source?.disconnect();
    this.microphone?.getTracks().forEach(track => track.stop());
    this.clearAudio(); void this.context?.close().catch(() => {});
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.microphone?.getAudioTracks().forEach(track => { track.enabled = !muted; });
    if (muted) this.send({ realtimeInput: { audioStreamEnd: true } });
    this.callbacks.status(muted ? 'Microphone muted' : 'Listening…');
  }
}
