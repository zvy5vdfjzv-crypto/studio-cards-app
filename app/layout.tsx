import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ESTÚDIO DE CARDS",
  description: "Gerador de cards de redes sociais — templates + lote + publicação",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700&family=Inter:wght@400;600;700;800;900&family=Archivo:wght@400;700;900&family=Oswald:wght@400;600;700&family=Anton&family=Montserrat:wght@400;700;900&family=Bebas+Neue&family=Playfair+Display:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
