VIRGO supports streamed text chat and a direct, bidirectional native audio conversation. The default live voice is Aoede (female). Both modes follow the language of the user's latest turn, including Hindi, Roman Hindi/Hinglish and other languages supported by the model. Explicit language preferences take precedence. The English catalogue and browser language do not force English answers. Language and voice quality vary by language. The microphone remains active during playback so the service can detect interruptions and clear queued audio.

Shopping is VIRGO's specialty, not a topic restriction. Normal questions about other topics receive direct answers without an unsolicited sales pitch. Customer and admin names come from verified sessions and the database; the browser does not supply the authenticated identity. Chat opens with a named welcome, and voice calls begin with a short spoken greeting using the last user's language (browser language is only a fallback before the first user turn). Switching accounts remounts the panel and loads that account's chat history.

Run the site normally with `npm run dev`. Open VIRGO and tap the microphone. Allow microphone access. Use localhost or HTTPS. Muting pauses microphone transmission; End, minimizing, changing tabs or closing the chat releases the microphone and audio resources. Sending a typed message ends the current voice call. Transcripts stay in the existing session chat history.

Server configuration (backend/.env, never frontend environment variables):

- `VIRGO_LIVE_API_KEY`: optional dedicated live audio key. Otherwise the active native chat provider key or existing server chat key is used.
- `VIRGO_LIVE_MODEL`: optional live model override; default `gemini-3.8-live`. A text generation model cannot be used for native live audio.

Permanent credentials stay on the server. The browser receives a single-use token bound to the model, instructions and female audio configuration, valid for starting a connection for one minute. Each connection uses a token with a 15 minute lifetime. Context compression manages long conversations. Session resumption handles are retained in memory; a server close warning schedules a connection rotation, and the client proactively rotates at 12 minutes if no warning arrives first. Every reconnect fetches fresh credentials constrained to the resumption handle. Up to three retries use increasing delays. If resumption fails, a fresh session receives the recent transcript instead; this fallback retains only recent text, not full audio history. Reconnects can cause a brief pause, and audio spoken during that pause is not replayed. Ending a call cancels reconnects and releases the microphone. Service outages or quota limits can still end a call, with a connection-specific message rather than an incorrect microphone warning.

Voice mode defaults to a large animated orb. Its visual is a clean 5.5-second silent loop cropped from the user's AmazingUI reference recording, preserving the glass sphere, cyan/blue petals and purple reflections. This is the reference's default animation, not its separate searching/thinking clips. Media provenance and format details are in `frontend/public/virgo/REFERENCE.md`. The user can switch between `Orb only` and `Orb + text` without restarting the call; the preference is stored locally. Hidden transcripts continue to update and remain available after the call. Measured microphone energy and actual output playback add a small scale response to the orb; the rendered petals play the original loop. Muted and reconnecting states are desaturated. Reduced-motion preferences show a matching still poster, and hidden tabs pause the visual's video. Product suggestions remain accessible through a button when text is hidden.

Public customer chat uses only the customer session cookie. Admin identity is read only for requests explicitly originating from the admin chat context and still requires a valid admin session cookie. A leftover admin cookie alone no longer personalizes guest storefront conversations.

VIRGO's primary role is the ATELIER shopping stylist. Both voice and text receive up to 100 active catalogue items and the signed-in user's cart from the server. Recommendations use exact product names, prices, sizes, colours and links; checkout confirms availability. Voice can call the read-only `show_products` tool, which displays up to three catalogue-validated in-stock products with photos, prices and product links. Unknown IDs, sold-out products and unknown tools are rejected. Text recommendations render matching product cards and internal product links. Neither mode adds items to cart or purchases on the user's behalf.

Voice doesn't browse the public web. VIRGO can still help with other topics when asked, without forcing a sales pitch into unrelated questions. Actual latency depends on the network and service availability. Existing text chat still supports configured alternate providers and file uploads.

Validation:

```sh
node --test --test-isolation=none backend/tools/virgo-live-test.cjs
node backend/tools/check-virgo-live.cjs
node frontend/node_modules/typescript/bin/tsc -p frontend/tsconfig.json --noEmit
node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit
node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json
node backend/tools/check-virgo-shopping.mjs
node backend/tools/check-virgo-conversation.mjs
node backend/tools/check-virgo-resume.mjs
```

The handshake check uses the environment key and opens an audio-configured session without sending microphone audio. The optional shopping check reads the real catalogue, sends a casual menswear request to the live model, validates its product IDs, acknowledges the display tool and waits for native audio and its transcript. It also checks that text shopping replies link real products. A real device conversation is still needed to assess perceived latency, echo cancellation and voice quality. Protocol references: [live WebSocket guide](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket), [ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [live tools](https://ai.google.dev/gemini-api/docs/live-api/tools).
