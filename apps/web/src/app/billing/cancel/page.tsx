'use client';

import { NavAnchor } from '@/components/NavAnchor';

export default function BillingCancelPage() {
  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 1rem' }}>Checkout Cancelled</h2>
        <p style={{ color: '#94a3b8' }}>No charges were made. Choose a plan when you are ready.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
          <NavAnchor href="/subscribe" className="btn primary">View Plans</NavAnchor>
          <NavAnchor href="/login" className="btn">Sign In</NavAnchor>
        </div>
      </div>
    </div>
  );
}