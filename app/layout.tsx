import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "e-pos(Ali's)",
  description: "Point of sale, inventory, purchases, and reporting for small retail businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}