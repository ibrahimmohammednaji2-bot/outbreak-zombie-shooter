import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    default: "Zombie Attack — a 3D shooter that opens in a tab",
    template: "%s · Zombie Attack",
  },
  description:
    "Survive endless zombie waves or fight a free-for-all. Four maps, twenty-two weapons, 140 skins. Runs in your browser on a laptop or an iPad — no install, no account.",
  openGraph: {
    title: "Zombie Attack",
    description:
      "A 3D zombie shooter that runs in your browser. No download, no account, no waiting.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* the first tab stop on every page */}
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
