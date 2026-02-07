import "./globals.css";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata = {
  title: "Sherlock — Avaliação Heurística UX",
  description: "Avaliação heurística de UX com inteligência artificial"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
          />
          <Script src="https://apis.google.com/js/api.js" strategy="afterInteractive" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
