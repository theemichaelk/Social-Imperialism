'use client';

import { IMPERIAL_TEMPLATES, GeneratedPost, TemplateCategory } from '@/lib/imperialContentTemplates';

type Props = {
  post: GeneratedPost;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  compact?: boolean;
};

export function SocialPostCard({ post, selected, onSelect, onEdit, onApprove, onReject, compact }: Props) {
  const template = IMPERIAL_TEMPLATES.find((t) => t.id === post.templateId) || IMPERIAL_TEMPLATES[0];
  const statusClass = post.status === 'approved' ? 'approved' : post.status === 'rejected' ? 'rejected' : post.status === 'scheduled' ? 'scheduled' : '';

  return (
    <article
      className={`si-post-card ${statusClass} ${selected ? 'selected' : ''} ${compact ? 'compact' : ''}`}
      onClick={onSelect}
      onKeyDown={onSelect ? (e) => e.key === 'Enter' && onSelect() : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div
        className="si-post-visual"
        style={{ background: post.mediaUrl ? undefined : `linear-gradient(145deg, ${template.gradient[0]}, ${template.gradient[1]})` }}
      >
        {post.mediaUrl ? (
          post.isVideo ? (
            <video src={post.mediaUrl} muted playsInline className="si-post-media" />
          ) : (
            <img src={post.mediaUrl} alt="" className="si-post-media" />
          )
        ) : (
          <div className="si-post-visual-placeholder">
            <span className="si-post-visual-icon">{template.contentType === 'carousel' ? '▤' : template.contentType === 'video' ? '▶' : '◆'}</span>
            <p className="si-post-visual-headline">{post.headline || template.label}</p>
          </div>
        )}
        <span className="si-post-template-badge" style={{ borderColor: template.accent, color: template.accent }}>
          {template.label}
        </span>
        {post.platform && <span className="si-post-platform-badge">{post.platform}</span>}
      </div>

      <div className="si-post-body">
        <p className="si-post-caption">{(post.content || '').slice(0, compact ? 100 : 180)}{(post.content || '').length > (compact ? 100 : 180) ? '…' : ''}</p>
        {post.status && post.status !== 'draft' && (
          <span className={`si-post-status si-post-status-${post.status}`}>{post.status}</span>
        )}
      </div>

      {(onEdit || onApprove || onReject) && (
        <div className="si-post-actions" onClick={(e) => e.stopPropagation()}>
          {onEdit && <button type="button" className="btn" onClick={onEdit}>Edit</button>}
          {onApprove && post.status !== 'approved' && (
            <button type="button" className="btn primary" onClick={onApprove}>Approve</button>
          )}
          {onReject && post.status !== 'rejected' && (
            <button type="button" className="btn" onClick={onReject}>Skip</button>
          )}
        </div>
      )}
    </article>
  );
}

export function TemplatePicker({
  selected,
  onChange,
}: {
  selected: TemplateCategory[];
  onChange: (ids: TemplateCategory[]) => void;
}) {
  function toggle(id: TemplateCategory) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="si-template-picker">
      {IMPERIAL_TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`si-template-chip ${selected.includes(t.id) ? 'active' : ''}`}
          style={{ '--chip-accent': t.accent } as React.CSSProperties}
          onClick={() => toggle(t.id)}
          title={t.description}
        >
          <span className="si-template-chip-dot" style={{ background: t.accent }} />
          {t.label}
        </button>
      ))}
    </div>
  );
}