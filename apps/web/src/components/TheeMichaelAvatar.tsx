import { THEE_MICHAEL_PROFILE } from '@/lib/theeMichaelProfile';

type TheeMichaelAvatarProps = {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  showRing?: boolean;
  title?: string;
};

const SIZE_CLASS = {
  sm: 'thee-michael-avatar-sm',
  md: 'thee-michael-avatar-md',
  lg: 'thee-michael-avatar-lg',
  hero: 'thee-michael-avatar-hero',
} as const;

export function TheeMichaelAvatar({
  size = 'md',
  className = '',
  showRing = true,
  title,
}: TheeMichaelAvatarProps) {
  return (
    <div
      className={`thee-michael-avatar ${SIZE_CLASS[size]} ${showRing ? 'thee-michael-avatar-ring' : ''} ${className}`.trim()}
      title={title || THEE_MICHAEL_PROFILE.displayName}
    >
      <img
        src={THEE_MICHAEL_PROFILE.image}
        alt={THEE_MICHAEL_PROFILE.imageAlt}
        className="thee-michael-avatar-img"
        width={1024}
        height={1008}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}