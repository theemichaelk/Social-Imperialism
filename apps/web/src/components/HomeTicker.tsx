'use client';

import { TICKER_ITEMS } from '@/lib/homeMedia';

export function HomeTicker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="home-ticker-wrap">
      <div className="home-ticker">
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="home-ticker-item">
            <span className="home-ticker-dot" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}