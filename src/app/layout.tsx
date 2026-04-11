import './globals.css';

import { Analytics } from '@vercel/analytics/next';
import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tranceed Technology - ERP System',
  description: 'Symbol of quality and trust - Tranceed Technology ERP System',
  icons: {
    icon: '/images/logo/logo.jpeg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans dark:bg-gray-900">
        <ThemeProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
