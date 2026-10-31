import { generateAtelierChat } from '../dist/lib/ai.js';
import { createVirgoLiveSession } from '../dist/lib/virgo-live.js';
import { prisma } from '../dist/database/prisma.js';
import assert from 'node:assert/strict';

async function main() {
  const cases = [
    { label: 'Hindi + normal topic + customer name', person: { name: 'Aarav', role: 'USER' }, message: 'नमस्ते, आज मेरा दिन बहुत अच्छा गया। मुझसे बात करो।', check: text => /[\u0900-\u097f]/.test(text) && /Aarav|आरव/i.test(text) },
    { label: 'Spanish + admin name', person: { name: 'Lucia', role: 'ADMIN' }, message: 'Hola, ¿puedes explicarme brevemente por qué el cielo es azul?', check: text => /Lucia|Lucía/.test(text) && /cielo|azul/i.test(text) },
    { label: 'Roman Hindi wine question after an old incorrect refusal', person: null, message: 'Okay, actually ek achhi wine suggest karo. Main adult hoon aur mujhe fruity taste pasand hai.', history: [{ role: 'user', content: 'Suggest a wine.' }, { role: 'assistant', content: "I only help with outfits and cannot recommend wines." }], check: text => /wine|riesling|moscato|merlot|pinot|rosé|rose/i.test(text) && !/I (?:only|mostly) help|can't recommend|cannot recommend|sirf.*(?:styling|fashion)/i.test(text) && /aap|tum|hain|ho|liye|pasand/i.test(text) },
  ];
  await Promise.all(cases.map(async item => {
    const reply = await generateAtelierChat({ message: item.message, person: item.person, history: item.history || [] });
    assert.ok(item.check(reply), `${item.label} failed: ${reply}`);
    console.log(`PASS ${item.label}: ${reply}`);
  }));
  if (process.argv.includes('--text-only')) return;
  const session = await createVirgoLiveSession({ person: { name: 'Aarav', role: 'USER' } });
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(session.token)}`);
    let text = ''; let audio = false; let done = false;
    const finish = error => { if (done) return; done = true; clearTimeout(timer); socket.close(); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => finish(new Error('Live conversation check timed out')), 45000);
    socket.onopen = () => socket.send(JSON.stringify({ setup: session.setup }));
    socket.onerror = () => finish(new Error('Live connection unavailable'));
    socket.onclose = () => { if (!done) finish(new Error('Live connection ended early')); };
    socket.onmessage = async event => {
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
        if (data.error) throw new Error('Live setup rejected');
        if (data.setupComplete) socket.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: 'नमस्ते, आज मेरा दिन अच्छा गया। आप कैसी हैं? बस एक छोटा सा जवाब दीजिए।' }] }], turnComplete: true } }));
        if (data.toolCall) throw new Error('Unrelated conversation called a shopping tool');
        text += data.serverContent?.outputTranscription?.text || '';
        if (data.serverContent?.modelTurn?.parts?.some(part => part.inlineData?.data)) audio = true;
        if (data.serverContent?.turnComplete && audio && text) {
          assert.ok(/[\u0900-\u097f]/.test(text) && /Aarav|आरव/i.test(text), 'Hindi voice greeting did not match language/name');
          console.log(`PASS live Hindi audio + named greeting: ${text}`); finish();
        }
      } catch (error) { finish(error); }
    };
  });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
