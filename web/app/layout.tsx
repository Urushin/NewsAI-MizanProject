import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Mizan.ai — Your Intelligent News Filter",
  description: "AI-powered personalized news briefing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
