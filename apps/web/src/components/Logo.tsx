import Image from 'next/image';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
};

const SIZES = { sm: 36, md: 48, lg: 72 };

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const px = SIZES[size];
  return (
    <div className={`brand-lockup ${className}`.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
      <Image
        src="/logo.png"
        alt="Social Imperialism"
        width={px}
        height={px}
        priority
        style={{ objectFit: 'contain', flexShrink: 0 }}
      />
      {showText && (
        <span className="brand-text" style={{
          fontWeight: 700,
          fontSize: size === 'lg' ? '1.35rem' : size === 'sm' ? '0.95rem' : '1.05rem',
          color: '#38bdf8',
          lineHeight: 1.2,
        }}>
          Social Imperialism
        </span>
      )}
    </div>
  );
}