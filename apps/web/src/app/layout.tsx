import './globals.css';
import { AppShell } from '@/components/AppShell';
import { SiteTrackingHead } from '@/components/SiteTrackingHead';
import { SiteTrackingBody } from '@/components/SiteTrackingBody';

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
        <SiteTrackingHead />
        <style
          dangerouslySetInnerHTML={{
            __html: '.nav-link-hint,.nav-link-features,.nav-link-features-summary,.nav-link-features-list,.nav-link-wrap>:not(.nav-link),.nav-link-wrap .nav-link-features,.nav-link-text>:not(.nav-link-label){display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;margin:0!important;padding:0!important}',
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function s(){document.querySelectorAll(".nav-link-features,.nav-link-hint,.nav-link-features-summary,.nav-link-features-list").forEach(function(e){e.remove()});document.querySelectorAll(".nav-link-wrap > *:not(.nav-link)").forEach(function(e){e.remove()});document.querySelectorAll(".nav-link-text").forEach(function(w){w.querySelectorAll(":scope > *:not(.nav-link-label)").forEach(function(e){e.remove()});});}s();document.addEventListener("DOMContentLoaded",s);if(typeof MutationObserver!=="undefined"){new MutationObserver(s).observe(document.documentElement,{childList:true,subtree:true});}})();`,
          }}
        />
      </head>
      <body>
        <SiteTrackingBody />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}