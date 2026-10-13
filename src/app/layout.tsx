import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sistem Antrian Digital | Kantor Camat Talawi",
    template: "%s | Antrian Talawi",
  },
  description: "Dashboard administrator sistem antrian digital Kantor Camat Talawi dengan algoritma First Come First Serve.",
  applicationName: "Antrian Talawi",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
