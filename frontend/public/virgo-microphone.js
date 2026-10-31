class VirgoMicrophone extends AudioWorkletProcessor {
  constructor() { super(); this.samples = []; this.position = 0; }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    // Resample the hardware rate to the live service's 16 kHz PCM input.
    const step = sampleRate / 16000;
    while (this.position < input.length) {
      const value = Math.max(-1, Math.min(1, input[Math.floor(this.position)]));
      this.samples.push(Math.round(value * (value < 0 ? 32768 : 32767)));
      this.position += step;
      if (this.samples.length === 1024) {
        const pcm = new Int16Array(this.samples);
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        this.samples = [];
      }
    }
    this.position -= input.length;
    return true;
  }
}
registerProcessor('virgo-microphone', VirgoMicrophone);
