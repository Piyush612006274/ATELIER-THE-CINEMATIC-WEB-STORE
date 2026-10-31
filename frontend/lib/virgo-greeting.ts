export function virgoGreeting(name: string | undefined, locale: string) {
  const person = name?.trim().split(/\s+/)[0];
  const greeting = person ? `, ${person}` : '';
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const greetings: Record<string, string> = {
    hi: `नमस्ते${greeting}! मैं VIRGO हूँ। आज किस बारे में बात करें? हमारी collection से outfit चुनने में भी मदद कर सकती हूँ।`,
    es: `¡Hola${greeting}! Soy VIRGO. ¿De qué te gustaría hablar? También puedo ayudarte a elegir un look de ATELIER.`,
    fr: `Bonjour${greeting} ! Je suis VIRGO. De quoi souhaitez-vous parler ? Je peux aussi vous aider à choisir une tenue ATELIER.`,
    de: `Hallo${greeting}! Ich bin VIRGO. Worüber möchtest du sprechen? Ich helfe dir auch bei der Auswahl eines ATELIER-Outfits.`,
    ar: `مرحباً${greeting}! أنا VIRGO. عمّ تود التحدث اليوم؟ يمكنني أيضاً مساعدتك في اختيار إطلالة من ATELIER.`,
    bn: `নমস্কার${greeting}! আমি VIRGO। আজ কী নিয়ে কথা বলবেন? ATELIER থেকে পোশাক বেছে নিতেও সাহায্য করতে পারি।`,
    ta: `வணக்கம்${greeting}! நான் VIRGO. இன்று எதைப் பற்றிப் பேச விரும்புகிறீர்கள்? ATELIER ஆடைகளைத் தேர்ந்தெடுக்கவும் உதவுவேன்.`,
    ja: `こんにちは${greeting}！VIRGOです。今日は何についてお話ししましょうか？ATELIERの服選びもお手伝いできます。`,
    zh: `你好${greeting}！我是 VIRGO。今天想聊些什么？我也可以帮你挑选 ATELIER 的穿搭。`,
  };
  return greetings[language] || `Hello${greeting}! I’m VIRGO. What’s on your mind today? I can also help you find your next ATELIER outfit.`;
}
