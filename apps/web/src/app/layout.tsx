import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clario — Split expenses with AI",
  description: "Track and split shared expenses. Chat naturally, pay fairly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#ffffff" }}>{children}</body>
    </html>
  );
}
