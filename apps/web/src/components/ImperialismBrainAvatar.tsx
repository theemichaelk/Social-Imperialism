'use client';

import { IMPERIALISM_BRAIN_AVATAR_ALT, IMPERIALISM_BRAIN_AVATAR_SRC } from '@/lib/imperialismBrainBrand';

export type ImperialismBrainAvatarSize = 'sm' | 'md' | 'lg' | 'xl' | 'fab';

type Props = {
  size?: ImperialismBrainAvatarSize;
  className?: string;
};

export function ImperialismBrainAvatar({ size = 'md', className = '' }: Props) {
  return (
    <img
      src={IMPERIALISM_BRAIN_AVATAR_SRC}
      alt={IMPERIALISM_BRAIN_AVATAR_ALT}
      className={['imperialism-brain-avatar', `is-${size}`, className].filter(Boolean).join(' ')}
      decoding="async"
    />
  );
}