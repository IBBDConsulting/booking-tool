import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking Platform",
  description: "Dein eigenes Buchungssystem",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
