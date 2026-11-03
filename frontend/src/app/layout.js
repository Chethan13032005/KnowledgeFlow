import "./globals.css";

export const metadata = {
  title: "KnowledgeFlow – Multi-source knowledge processing",
  description:
    "Ingest • Retrieve • Understand • Generate. Your personal, grounded AI over documents, web, and videos.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}