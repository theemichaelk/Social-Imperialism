import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata = {
  title: 'Social Imperialism — AI Social Media Automation',
  description: 'Discover, engage, publish, and automate across 14+ platforms from one mission control dashboard.',
  icons: { icon: '/logo.png', apple: '/logo.png' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#020408',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: '.nav-link-hint,.nav-link-features,.nav-link-features-summary,.nav-link-features-list{display:none!important}',
          }}
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}