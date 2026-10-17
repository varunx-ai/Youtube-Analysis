import type { Metadata } from "next";
import Quota from "../components/Quota";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = { title: "Channel Scout", description: "Find YouTube channels by keyword and see what works for them." };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="top">
          <nav>
            <Link href="/" className="mark">Channel Scout</Link>
            <span className="nav-context">Content Intelligence Workspace</span>
          </nav>
          <Quota />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
