import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KSIJ DAR League",
  description: "gofiber KSIJ Premier League & Care & Cure KSIJ Juniors PL",
};

// Inline script runs before paint to avoid a light/dark flash on load
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('ksij-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored ? stored === 'dark' : prefersDark;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-[#0B1220] text-[#0B3363] dark:text-white transition-colors">
        {children}
      </body>
    </html>
  );
}
