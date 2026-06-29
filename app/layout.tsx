import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PAM – Product Agile Manager",
  description:
    "Analyze any website URL and generate Gherkin stories for each functional section.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
