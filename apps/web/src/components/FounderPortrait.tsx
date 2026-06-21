import { FOUNDER } from '@/lib/founder';

type FounderPortraitProps = {
  className?: string;
  showScan?: boolean;
  showCorners?: boolean;
};

export function FounderPortrait({
  className = '',
  showScan = false,
  showCorners = true,
}: FounderPortraitProps) {
  return (
    <div className={`founder-portrait ${className}`.trim()}>
      <div className="founder-portrait-glow" aria-hidden />
      <img
        src={FOUNDER.image}
        alt={FOUNDER.imageAlt}
        className="founder-portrait-img"
        width={1024}
        height={1008}
        loading="lazy"
        decoding="async"
      />
      {showCorners && (
        <>
          <div className="home-holo-corner tl" />
          <div className="home-holo-corner tr" />
          <div className="home-holo-corner bl" />
          <div className="home-holo-corner br" />
        </>
      )}
      {showScan && <div className="founder-portrait-scan" aria-hidden />}
    </div>
  );
}