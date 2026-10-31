import "./globals.css";
import "./interactive.css";
import "./site-studio.css";

export const metadata = {
  title: "ATELIER \u2014 Exceptional fashion for every moment",
  description: "ATELIER is a premium contemporary fashion label for modern men and women."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Google+Sans+Code:wght@400;700&family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a className="skip-to-content" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
