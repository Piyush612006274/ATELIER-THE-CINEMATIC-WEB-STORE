// Cinematic home sections. Every string/image here is editable from Admin → Visual Studio.
const I = "/images/cinematic";
export const CIN_TYPES = ["CIN_HERO","CIN_TICKER","CIN_FILM","CIN_EDIT","CIN_MANIFESTO","CIN_SHOP","CIN_LOOKBOOK","CIN_LETTER"] as const;
export const cinematicDefaults: Record<string, Record<string, any>> = {
  CIN_HERO: {
    eyebrow: "The new uniform · Chapter 01", line1: "Form in", line2: "motion.",
    description: "A study in silhouette, texture and movement. Considered clothing made to live beyond the frame.",
    button1Text: "Enter the film", button1Link: "#film", button2Text: "Discover the edit", button2Link: "#collection",
    footnote: "An image-based fashion film", footnoteNum: "01—03", scrollCue: "Scroll to direct the camera", autoplay: true, intervalMs: 6500,
    looks: [
      { tab: "Winter form", mode: "cutout", figure: `${I}/winterCutout.webp`, bg: `${I}/winterBg.webp`, number: "01", caption: "The winter\nform.", sub: "Look 01 / wool & structure", rail: "Move to explore · Image depth", coord: "52° 31' N / FORM STUDY" },
      { tab: "Dark denim", mode: "cutout", figure: `${I}/denimCutout.webp`, bg: `${I}/denimPhoto.webp`, number: "02", caption: "Dark denim.\nNew dimension.", sub: "Look 02 / structured indigo", rail: "Layer study · Denim in focus", coord: "01 / TEXTURE STUDY" },
      { tab: "The editorial", mode: "photo", figure: `${I}/heroCity.webp`, bg: `${I}/heroCity.webp`, number: "03", caption: "A new point\nof view.", sub: "Look 03 / the editorial", rail: "Campaign frame · City in motion", coord: "03 / MOVEMENT STUDY" }
    ]
  },
  CIN_TICKER: { items: [{ text: "Less, but considered" }, { text: "Designed to endure" }, { text: "Wear your own story" }, { text: "Form follows feeling" }] },
  CIN_FILM: { presentation: "film", heading: "A look for every day.", eyebrow: "ATELIER / THE COLLECTION", cardRadius: 32, cardTheme: "site", cardBackground: "#101311", cardTextColor: "#f1eee7", animationMs: 600, imageFit: "contain", show3D: true, autoplay: false, intervalMs: 5500, frames: [
    { chapter: "Silhouette", title: "The art of", emphasis: "silhouette.", desc: "Begin with the full look. As you scroll, the image moves like a camera travelling into a campaign frame.", tag: "Quiet presence.", image: `${I}/winterBg.webp` },
    { chapter: "Texture", title: "Texture in", emphasis: "focus.", desc: "The camera comes closer to fabric, shape and construction. A single product photograph becomes a moment in the visual sequence.", tag: "Texture in focus.", image: `${I}/denimPhoto.webp` },
    { chapter: "Movement", title: "Made to", emphasis: "move.", desc: "The final frame opens into the collection. Every frame here is an image you can swap from the admin dashboard.", tag: "Made to move.", image: `${I}/heroCity.webp` }
  ], hint: "Scroll to move through looks" },
  CIN_EDIT: { micro: "01 / The point of view", title: "Pieces with\na point of view.", body: "Different rhythms. Strong forms. A wardrobe built around the pieces you return to, with a little room for the unexpected.", tiles: [
    { index: "Chapter 01 · The everyday icons", title: "Everyday,\nreconsidered.", meta: "Menswear / understated layers", image: `${I}/menCollection.webp`, link: "/shop?gender=Men" },
    { index: "Chapter 02 · Form and fluidity", title: "Quietly\nunforgettable.", meta: "Womenswear / considered shapes", image: `${I}/womenCollection.webp`, link: "/shop?gender=Women" }
  ] },
  CIN_MANIFESTO: { micro: "02 / A quieter kind of luxury", title: "Not made for\na moment.", emphasis: "Made for life.", body: "Great design is felt before it is noticed. Thoughtful materials, useful details and silhouettes that leave room for you to be yourself.", mark: "Form · Function · Feeling" },
  CIN_SHOP: { micro: "03 / Curated for you", title: "Shop the\nmoving image.", body: "The film moves into the wardrobe. Explore selected pieces from the ATELIER catalogue.", filter: "all", limit: 6, showFilters: true, allLabel: "All pieces", menLabel: "Menswear", womenLabel: "Womenswear", noteLeft: "Selected pieces from ATELIER catalogue", noteRight: "Free delivery over ₹3,000 · 30-day returns", viewAllText: "View all pieces", viewAllLink: "/shop" },
  CIN_LOOKBOOK: { micro: "04 / The lookbook", title: "Wear it\nyour way.", body: "Move through the looks. A little different in every frame, always unmistakably your own.", looks: [
    { label: "Look 01 — The statement", image: `${I}/heroCity.webp`, link: "/shop" },
    { label: "Look 02 — The layer", image: `${I}/overcoat.webp`, link: "/shop?gender=Men" },
    { label: "Look 03 — The structure", image: `${I}/womenBlazer.webp`, link: "/shop?gender=Women" },
    { label: "Look 04 — The everyday", image: `${I}/denimPhoto.webp`, link: "/shop?gender=Men" }
  ] },
  CIN_LETTER: { micro: "The atelier letter", title: "A little more\nin your inbox.", body: "First access to new edits, notes from the studio and ideas worth keeping. Only when there is something to say.", placeholder: "Your email address", button: "Join us" }
};
export const cinematicHomeSections = (CIN_TYPES as readonly string[]).map(type => ({ type, content: cinematicDefaults[type] }));
