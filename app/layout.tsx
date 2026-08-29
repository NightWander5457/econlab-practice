import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000/';
const normalizedSiteUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
const socialImageUrl = new URL('og.png', normalizedSiteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(normalizedSiteUrl),
  title: 'EconLab | 基础经济学训练',
  description: '面向英文基础薄弱学生的双语经济学概念、图形与错题训练。',
  openGraph: {
    title: 'EconLab | 基础经济学训练',
    description: '双语概念、图形与错题反复训练，让基础经济学真正学会。',
    images: [socialImageUrl],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EconLab | 基础经济学训练',
    description: '双语概念、图形与错题反复训练，让基础经济学真正学会。',
    images: [socialImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
