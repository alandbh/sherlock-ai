import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "Avaliação Heurística UX",
  description: "Web App para avaliação heurística com Gemini 1.5 Pro"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
        <Script src="https://apis.google.com/js/api.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
