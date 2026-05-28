import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { PlatformProvider } from "../components/PlatformProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://newsai.local";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NewsAI — Your Intelligent News Filter",
    template: "%s | NewsAI",
  },
  description:
    "AI-powered personalized news briefing. Get only the news that matters to you, filtered by artificial intelligence.",
  keywords: [
    "AI news",
    "personalized news",
    "curation",
    "intelligence artificielle",
    "productivité",
    "veille technologique",
    "actualités intelligentes",
  ],
  authors: [{ name: "NewsAI" }],
  creator: "NewsAI",
  publisher: "NewsAI",

  // Canonical
  alternates: {
    canonical: "/",
    languages: {
      "fr-FR": "/fr",
      "en-US": "/en",
      "ja-JP": "/ja",
    },
  },

  // OpenGraph
  openGraph: {
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["en_US", "ja_JP"],
    url: SITE_URL,
    siteName: "NewsAI",
    title: "NewsAI — Your Intelligent News Filter",
    description:
      "AI-powered personalized news briefing. Get only the news that matters to you.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NewsAI Open Graph Image",
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "NewsAI — Your Intelligent News Filter",
    description:
      "AI-powered personalized news briefing. Get only the news that matters to you.",
    images: ["/og-image.png"],
    creator: "@newsaiai",
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Icons
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFCF8" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" }
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// JSON-LD structured data for the website
function WebsiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "NewsAI",
    url: SITE_URL,
    description:
      "AI-powered personalized news briefing platform that filters and summarizes news articles based on your interests.",
    applicationCategory: "NewsApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    creator: {
      "@type": "Organization",
      name: "NewsAI Team",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${newsreader.variable} ${inter.className} antialiased selection:bg-zinc-200/60 selection:text-zinc-900`}>
        <WebsiteJsonLd />
        <AuthProvider>
          <PlatformProvider>
            <ToastProvider>{children}</ToastProvider>
          </PlatformProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
