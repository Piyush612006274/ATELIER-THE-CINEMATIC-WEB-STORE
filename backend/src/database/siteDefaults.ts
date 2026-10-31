// Factory defaults for the design/content settings. Used by "Factory reset" so the
// Site Settings form is never left blank, and by snapshots to know which keys are design keys.
export const DESIGN_SETTING_KEYS = [
  "navLinks","siteName","tagline","headerHomeLabel","headerShopLabel","headerCollectionsLabel","headerAboutLabel",
  "footerTagline","footerShopLabel","footerAboutLabel","footerHelpLabel","announcement","newsletterText","copyrightText",
  "socialInstagram","socialPinterest","socialFacebook","theme","imageSettings","siteCopyOverrides","siteMediaOverrides","siteMotion",
  "hero1Eyebrow","hero1Line1","hero1Line2","hero1Line3","hero1Text","hero1Image",
  "hero2Eyebrow","hero2Line1","hero2Line2","hero2Line3","hero2Text","hero2Image",
  "hero3Eyebrow","hero3Line1","hero3Line2","hero3Line3","hero3Text","hero3Image",
  "homeTicker","homeFilmTitle","homeFilmText","homeManifestoTitle","homeManifestoEmphasis","homeManifestoBody",
  "homeShopTitle","homeShopBody","homeEditorialCard1Title","homeEditorialCard1Label","homeEditorialCard1Image",
  "homeEditorialCard2Title","homeEditorialCard2Label","homeEditorialCard2Image"
] as const;

// Keys with no entry here (navLinks, theme) are simply removed on factory reset: the storefront has built-in fallbacks.
export const DESIGN_DEFAULT_SETTINGS: Record<string, string> = {
  siteName:"ATELIER", tagline:"Exceptional fashion for every moment.",
  headerHomeLabel:"Home", headerShopLabel:"Shop", headerCollectionsLabel:"Collections", headerAboutLabel:"About",
  footerTagline:"Quiet luxury, considered for modern life.", footerShopLabel:"Shop", footerAboutLabel:"About", footerHelpLabel:"Help",
  announcement:"", newsletterText:"Stay in the know.", copyrightText:"© 2026 ATELIER. All rights reserved.",
  socialInstagram:"Instagram", socialPinterest:"Pinterest", socialFacebook:"Facebook",
  hero1Eyebrow:"THE ATELIER OBJECT SERIES", hero1Line1:"TECHNOLOGY", hero1Line2:"ENGINEERED", hero1Line3:"TO ENDURE.", hero1Text:"Technical outerwear. Considered materials. A modern uniform built for the everyday.", hero1Image:"/images/hero/hero-03.jpg",
  hero2Eyebrow:"THE QUIET ART OF DRESS.", hero2Line1:"A Softer", hero2Line2:"Kind of", hero2Line3:"Confidence", hero2Text:"Clean lines, considered materials, and silhouettes that move with you.", hero2Image:"/images/hero/hero-01.jpg",
  hero3Eyebrow:"MADE FOR MODERN LIVES.", hero3Line1:"Layered", hero3Line2:"With", hero3Line3:"Intention", hero3Text:"Wardrobe essentials with an editorial point of view.", hero3Image:"/images/hero/hero-03.jpg",
  homeTicker:"LESS, BUT CONSIDERED ✳ DESIGNED TO ENDURE ✳ WEAR YOUR OWN STORY ✳ FORM FOLLOWS FEELING ✳ LESS, BUT CONSIDERED ✳ DESIGNED TO ENDURE ✳",
  homeFilmTitle:"The art of silhouette.",
  homeFilmText:"Different rhythms. Strong forms. A wardrobe built around the pieces you return to, with a little room for the unexpected.",
  homeManifestoTitle:"Not made for\na moment.",
  homeManifestoEmphasis:"Made for life.",
  homeManifestoBody:"Great design is felt before it is noticed. Thoughtful materials, useful details and silhouettes that leave room for you to be yourself.",
  homeShopTitle:"Shop the\nmoving image.",
  homeShopBody:"The film moves into the wardrobe. Explore selected pieces from the ATELIER catalogue.",
  homeEditorialCard1Title:"Everyday, reconsidered.",
  homeEditorialCard1Label:"Menswear / understated layers",
  homeEditorialCard1Image:"/images/collections/mens-collection.jpg",
  homeEditorialCard2Title:"Quietly unforgettable.",
  homeEditorialCard2Label:"Womenswear / considered shapes",
  homeEditorialCard2Image:"/images/collections/womens-collection.jpg"
};
