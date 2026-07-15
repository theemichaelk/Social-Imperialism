import { SITE_BRAND, getModuleCount } from '@/lib/siteBlueprint';
import { FOUNDER } from '@/lib/founder';

export type StaticPageSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type StaticPageContent = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  sections: StaticPageSection[];
};

export function getAboutPageContent(): StaticPageContent {
  const modules = getModuleCount();
  return {
    eyebrow: 'Company',
    title: `About ${SITE_BRAND.name}`,
    subtitle: `${SITE_BRAND.tagline} — one mission control for discovery, AI replies, publishing, and growth automation.`,
    sections: [
      {
        title: 'What we built',
        paragraphs: [
          `${SITE_BRAND.name} unifies social discovery, AI-assisted engagement, content publishing, keyword monitoring, Reddit and Quora growth workflows, and campaign operations into a single web and desktop platform.`,
          `Teams manage multiple brand campaigns in isolation — each with its own keywords, linked accounts, schedules, and analytics — while sharing one Integrations Hub for API keys and OAuth connections.`,
        ],
      },
      {
        title: 'Who it is for',
        paragraphs: [
          'Agencies, founders, and growth operators who need live API connectivity—not mock dashboards—and human-in-the-loop approval before anything posts on their behalf.',
        ],
        bullets: [
          'Multi-campaign workspace with Campaign Manager',
          `${modules}+ product modules from Setup Wizard through Growth Lab`,
          'Desktop app parity with cloud SaaS deployment',
          'Partner API and webhooks for Zapier, Make, and custom stacks',
        ],
      },
      {
        title: 'Built by',
        paragraphs: [
          `${SITE_BRAND.name} is created by ${FOUNDER.name} (${FOUNDER.role}). Learn more on the Founder page or reach us through Contact.`,
        ],
      },
    ],
  };
}

export function getContactPageContent(): StaticPageContent {
  return {
    eyebrow: 'Support',
    title: 'Contact',
    subtitle: 'Questions about billing, integrations, enterprise plans, or technical support — we respond by email.',
    sections: [
      {
        title: 'General & product support',
        paragraphs: [
          `Email: ${FOUNDER.email}`,
          'Include your account email and a short description of the module or integration you need help with (Dashboard, Keywords, Integrations, Campaign Manager, etc.).',
        ],
      },
      {
        title: 'In-app help',
        paragraphs: [
          'Subscribers can use Imperialism Brain inside the app for live navigation, setup guidance, and module-specific troubleshooting.',
        ],
        bullets: [
          'Open Support from the sidebar after signing in',
          'Use the Setup Wizard for first-time brand and API wiring',
          'Check Settings → Live Audit for API health',
        ],
      },
      {
        title: 'Sales & enterprise',
        paragraphs: [
          'For agency volume, white-label, or custom deployment questions, email us with your team size and platform requirements.',
        ],
      },
    ],
  };
}

export function getPrivacyPageContent(): StaticPageContent {
  const year = new Date().getFullYear();
  return {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    subtitle: `Last updated: ${year}. This policy describes how ${SITE_BRAND.name} collects and uses information when you use our website and application.`,
    sections: [
      {
        title: 'Information we collect',
        paragraphs: [
          'We collect information you provide directly: account email, organization name, campaign and brand settings, API credentials you store in Integrations, and content you create (posts, keywords, replies, automations).',
          'We collect usage data necessary to operate the service: login sessions, feature usage, error logs, and API probe results. We do not sell your personal information.',
        ],
      },
      {
        title: 'How we use information',
        paragraphs: [
          'Your data is used to run the product you subscribed to: fetching feeds, generating AI drafts, scheduling posts, and syncing connected platforms.',
        ],
        bullets: [
          'Authenticate your account and enforce subscription access',
          'Store campaign-scoped keywords, accounts, and schedules',
          'Execute automations and engagement actions you approve',
          'Improve reliability, security, and support responses',
        ],
      },
      {
        title: 'Third-party services',
        paragraphs: [
          'When you connect social platforms, AI providers, or email/SERP APIs, your requests are sent to those third parties under their terms. You control which keys and OAuth accounts are stored in your workspace.',
          'Payment processing is handled by our billing provider; we do not store full card numbers on our servers.',
        ],
      },
      {
        title: 'Data retention & security',
        paragraphs: [
          'Campaign data is retained while your account is active. You may delete campaigns from Campaign Manager; account deletion requests can be sent to our contact email.',
          'We use industry-standard transport encryption (HTTPS) and access controls. You are responsible for safeguarding API keys and team login credentials.',
        ],
      },
      {
        title: 'Your rights & contact',
        paragraphs: [
          `You may request access, correction, or deletion of personal data by emailing ${FOUNDER.email}. California and GDPR rights apply where applicable.`,
        ],
      },
    ],
  };
}

export function getTermsPageContent(): StaticPageContent {
  const year = new Date().getFullYear();
  return {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    subtitle: `Last updated: ${year}. By using ${SITE_BRAND.name}, you agree to these terms.`,
    sections: [
      {
        title: 'Service description',
        paragraphs: [
          `${SITE_BRAND.name} provides software for social media discovery, content creation, scheduling, and automation. Features depend on your subscription plan and connected third-party APIs.`,
        ],
      },
      {
        title: 'Account responsibilities',
        paragraphs: [
          'You must provide accurate registration information and keep credentials secure. You are responsible for all activity under your account and for compliance with each social platform’s rules when posting or engaging through our tools.',
        ],
        bullets: [
          'Do not share login tokens or API keys publicly',
          'Use human approval queues where the product provides them',
          'Do not use the service for spam, harassment, or illegal content',
        ],
      },
      {
        title: 'Subscriptions & billing',
        paragraphs: [
          'Paid plans renew according to the billing cycle shown at checkout unless canceled. Fees are non-refundable except where required by law or explicitly stated in your plan.',
          'We may change pricing with notice; continued use after notice constitutes acceptance of new rates for subsequent billing periods.',
        ],
      },
      {
        title: 'AI-generated content',
        paragraphs: [
          'AI drafts and suggestions are provided as-is. You review and approve content before publishing. We do not guarantee reach, engagement, or platform approval of AI-assisted posts.',
        ],
      },
      {
        title: 'Limitation of liability',
        paragraphs: [
          'The service is provided "as is" without warranties of uninterrupted operation. To the maximum extent permitted by law, our liability is limited to fees paid in the twelve months before a claim.',
        ],
      },
      {
        title: 'Termination',
        paragraphs: [
          'You may cancel anytime through billing settings. We may suspend accounts that violate these terms or pose security risk. Upon termination, access ends but export of your data may be requested via contact email.',
        ],
      },
      {
        title: 'Contact',
        paragraphs: [
          `Questions about these terms: ${FOUNDER.email}`,
        ],
      },
    ],
  };
}