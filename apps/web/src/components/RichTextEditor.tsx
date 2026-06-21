'use client';

import { useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
};

export function RichTextEditor({ value, onChange, rows = 12, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || 'text';
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
  }

  function insertLink() {
    const url = window.prompt('Link URL');
    if (!url) return;
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const label = value.slice(start, end) || 'link';
    const next = `${value.slice(0, start)}[${label}](${url})${value.slice(end)}`;
    onChange(next);
  }

  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => wrap('**', '**')}>Bold</button>
        <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => wrap('*', '*')}>Italic</button>
        <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => wrap('\n- ', '')}>List</button>
        <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={insertLink}>Link</button>
        <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => wrap('\n> ', '')}>Quote</button>
        <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => wrap('\n## ', '')}>Heading</button>
      </div>
      <textarea
        ref={textareaRef}
        className="input answer-editor"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}