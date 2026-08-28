import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'EconLab | 基础经济学训练',
  description: '面向英文基础薄弱学生的双语经济学概念、图形与错题训练。',
  openGraph: {
    title: 'EconLab | 基础经济学训练',
    description: '双语概念、图形与错题反复训练，让基础经济学真正学会。',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EconLab | 基础经济学训练',
    description: '双语概念、图形与错题反复训练，让基础经济学真正学会。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
