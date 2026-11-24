import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { preconnect } from "react-dom";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display face: a text serif with the feel of a printed survey report.
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "GroundTruth: know what your land was before you buy it",
  description:
    "Satellite history of a plot in India: was it ever a lake or wetland, when was it filled, and how low does it sit? A screening tool, not a legal opinion.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0e151b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Satellite pictures, map tiles and the water overlay come from these hosts.
  preconnect("https://earthengine.googleapis.com");
  preconnect("https://server.arcgisonline.com");
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
