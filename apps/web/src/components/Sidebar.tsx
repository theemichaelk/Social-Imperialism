'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS } from '@/lib/nav';
import { Logo } from '@/components/Logo';

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <Logo size="sm" showText />
        </Link>
      </div>
      {NAV_SECTIONS.map((section) => (
        <div key={section.id} className="nav-section">
          <div className="nav-section-label">{section.label}</div>
          {section.items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`nav-link ${pathname === item.href ? 'active' : ''}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </aside>
  );
}