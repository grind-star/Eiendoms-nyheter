import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eiendomsnyheter",
  description: "Norske eiendomsnyheter fra eiendomswatch.no, estatenyheter.no, E24, DN og Finansavisen",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body style={{ margin: 0, padding: 0, background: "#030703" }}>
        {children}
      </body>
    </html>
  );
}
