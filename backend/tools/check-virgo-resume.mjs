import { createVirgoLiveSession } from '../dist/lib/virgo-live.js';
import { prisma } from '../dist/database/prisma.js';

async function connect(resumeHandle, prompt) {
  const session = await createVirgoLiveSession({ resumeHandle });
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(session.token)}`);
    let handle, text = '', complete = false, done = false;
    const finish = error => { if (done) return; done = true; clearTimeout(timer); socket.close(); error ? reject(error) : resolve({ handle, text }); };
    const timer = setTimeout(() => finish(new Error('VIRGO resume check timed out')), 45000);
    socket.onopen = () => socket.send(JSON.stringify({ setup: session.setup }));
    socket.onerror = () => finish(new Error('VIRGO resume connection unavailable'));
    socket.onclose = () => { if (!done) finish(new Error('VIRGO resume connection ended early')); };
    socket.onmessage = async event => {
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
        if (data.error) throw new Error('VIRGO resume setup rejected');
        if (data.setupComplete) socket.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: prompt }] }], turnComplete: true } }));
        if (data.sessionResumptionUpdate?.resumable) handle = data.sessionResumptionUpdate.newHandle;
        text += data.serverContent?.outputTranscription?.text || '';
        if (data.serverContent?.turnComplete) complete = true;
        if (complete && handle && text.trim()) finish();
      } catch (error) { finish(error); }
    };
  });
}
try {
  const first = await connect(undefined, 'Remember my secret word: orchid. Reply with just: Remembered.');
  const second = await connect(first.handle, 'What secret word did I ask you to remember? Reply with just that word.');
  if (!/orchid/i.test(second.text)) throw new Error('VIRGO did not retain session memory across reconnect');
  console.log('PASS: fresh-token session resumption retained conversation memory:', second.text);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
