import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUSS FoodLoop — Beyond the Queue",
  description: "Cafeteria crowd checks, food ordering and your own FoodLoop account. Less waiting. More campus life.",
  icons: {
    icon: "/assets/favicon.svg",
    shortcut: "/assets/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
