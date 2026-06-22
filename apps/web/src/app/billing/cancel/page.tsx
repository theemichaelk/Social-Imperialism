'use client';

import { NavAnchor } from '@/components/NavAnchor';

export default function BillingCancelPage() {
  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 1rem' }}>Checkout Cancelled</h2>
        <p style={{ color: '#94a3b8' }}>No charges were made. You can choose a plan anytime from Settings.</p>
        <NavAnchor href="/settings?tab=billing" className="btn primary" style={{ marginTop: '1rem' }}>
          Back to Billing
        </NavAnchor>
      </div>
    </div>
  );
}