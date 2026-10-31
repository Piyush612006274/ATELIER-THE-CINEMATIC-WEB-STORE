# Chatbot fixes (V21 -> V22)

Files changed:
- frontend/components/storefront/storefront.tsx  (AIPetControl + AtelierAIPanel rewritten, parent wiring)
- frontend/app/chatbot.css  (NEW - all chat styles, classes `aic-*`)
- frontend/app/globals.css  (old `.ai-shell/.ai-compose/...` overrides removed, imports chatbot.css)
- backend/src/lib/chatAttachments.ts  (safer file-name / base64 validation)

Run: `npm run install:all` then `npm run typecheck` then `npm run dev`.

## What was fixed
1. Scroll: log is the only scroller (min-height:0); sending pins to latest; ResizeObserver keeps it pinned;
   long answers open at their first line; "Latest" button when user scrolled up.
2. Owl/window: owl hides whenever chat is open (header, nav or owl), returns on minimize/close.
   Owl position is now saved per device (was reset when the login state loaded -> owl jumped to default corner).
   Chat window opens exactly where the owl sits; only size is remembered.
3. Minimize = real minimize (owl comes back with a green "chat running" dot; click restores). Reset is a separate icon. Esc minimizes.
4. Owl opens chat with a single click (drag still moves it).
5. Attachments: paperclip, drag&drop (with overlay), Ctrl+V anywhere in the open chat (images), previews, remove, limits.
   Backend reads images, PDF, DOCX/XLSX/PPTX, TXT/CSV/JSON/XML, ZIP (text inside) and MP4/WebM (Gemini only).
   Unsupported image formats (gif/bmp/avif) are converted to PNG in the browser.
6. Compact composer: attach | text (auto-grow) | mic | 36px round send. Mobile = bottom sheet.
7. Owl states: thinking / listening / speaking pulse; header status text; reduced-motion respected.
8. Voice bugs: stale-closure (lost history) and repeated first transcript fixed; recovers after errors.
9. Chat persists for the browser session; "New chat" link; assistant replies render **bold** and bullets.

## Lookbook auto-slide (frontend/components/storefront/cinematic.tsx -> CinLookbook)
- Slides one look every ~3.6 s and glides back to the first after the last.
- Pauses on hover, focus, touch, drag, wheel, when the tab is hidden or the section is off-screen.
- Prev / Pause-Play / Next buttons + Left/Right arrow keys. Honors prefers-reduced-motion (no autoplay).
- Styles for the controls are at the end of frontend/app/chatbot.css.
