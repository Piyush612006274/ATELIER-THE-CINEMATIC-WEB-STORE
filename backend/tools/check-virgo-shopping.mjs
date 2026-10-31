import { prisma } from '../dist/database/prisma.js';
import { createVirgoLiveSession } from '../dist/lib/virgo-live.js';
import { generateAtelierChat } from '../dist/lib/ai.js';

// Read-only catalogue + real audio-model shopping turn, without recording a microphone.
async function main() {
  const products = await prisma.product.findMany({ where: { status: 'ACTIVE' }, include: { category: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  if (!products.some(p => p.stock > 0)) throw new Error('No in-stock products available for the shopping check.');
  if (!process.argv.includes('--text-only')) {
  const session = await createVirgoLiveSession({ products });
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(session.token)}`);
    let shown = false;
    let audioReceived = false;
    let transcript = '';
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); socket.close();
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new Error('Shopping turn timed out.')), 45_000);
    socket.onopen = () => socket.send(JSON.stringify({ setup: session.setup }));
    socket.onerror = () => finish(new Error('Live shopping connection unavailable.'));
    socket.onclose = () => { if (!settled) finish(new Error('Live shopping connection ended before a response.')); };
    socket.onmessage = async event => {
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
        if (process.env.VIRGO_TEST_TRACE === '1') console.log('Live event:', Object.keys(data).join(','), data.serverContent ? Object.keys(data.serverContent).join(',') : '');
        if (data.error) { finish(new Error('Live shopping setup was rejected.')); return; }
        if (data.setupComplete) socket.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: 'I am visiting your ATELIER website and need casual menswear for everyday use. Please find and show me 2 or 3 actual in-stock items from your website now, tell me their prices and why they work together.' }] }], turnComplete: true } }));
        if (data.toolCall?.functionCalls) {
          const responses = data.toolCall.functionCalls.map((call) => {
            const chosen = (Array.isArray(call.args?.productIds) ? call.args.productIds : []).map((id) => session.products.find(p => p.id === id && p.stock > 0)).filter(Boolean);
            if (call.name !== 'show_products' || !chosen.length) throw new Error('Shopping model requested invalid product recommendations.');
            shown = true;
            console.log('Actual catalogue recommendations:', chosen.map((p) => `${p.name} (${p.currency} ${p.price})`).join('; '));
            return { id: call.id, name: call.name, response: { displayed: true, products: chosen } };
          });
          socket.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
        }
        if (data.serverContent?.outputTranscription?.text) transcript += data.serverContent.outputTranscription.text;
        if (data.serverContent?.modelTurn?.parts?.some(part => part.inlineData?.data)) audioReceived = true;
        if (data.serverContent?.turnComplete) {
          if (!shown) { finish(new Error('Shopping response did not request actual product cards.')); return; }
          if (!audioReceived || !transcript.trim()) return;
          if (/can't (?:directly )?browse|cannot (?:see|access).*products/i.test(transcript)) { finish(new Error('Shopping response incorrectly denied catalogue access.')); return; }
          console.log('VIRGO shopping response:', transcript.replace(/gemini/gi, 'VIRGO'));
          console.log('PASS: live shopping turn used real in-stock catalogue IDs and returned a spoken response.');
          finish();
        }
      } catch { finish(new Error('Live shopping response could not be validated.')); }
    };
  });
  }
  const reply = await generateAtelierChat({ products, message: 'Find me 2 actual casual menswear pieces from your ATELIER website, with prices and product links. Recommend them now; you can refine my preferences afterwards.' });
  const linked = products.filter(product => product.stock > 0 && reply.includes(`/product/${encodeURIComponent(product.id)}`));
  if (linked.length < 2) throw new Error('Text shopping response did not link actual in-stock products.');
  console.log('PASS: text shopping reply linked real catalogue items:', linked.map(p => p.name).join('; '));
}
main().catch(error => { console.error(/^(?:Shopping |Live shopping |Text shopping )/.test(error.message) ? error.message : 'VIRGO shopping check failed; inspect configuration and catalogue availability.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
