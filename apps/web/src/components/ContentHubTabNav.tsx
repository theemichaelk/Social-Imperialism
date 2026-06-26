'use client';

import { ManageableTabNav } from '@/components/ManageableTabNav';

export type ContentHubTab = {
  id: string;
  label: string;
  group: string;
  locked?: boolean;
};

type Props = {
  tabs: ContentHubTab[];
  active: string;
  onChange: (id: string) => void;
};

export function ContentHubTabNav({ tabs, active, onChange }: Props) {
  return (
    <ManageableTabNav
      pageId="content-hub"
      catalog={tabs}
      active={active}
      onChange={onChange}
      grouped
    />
  );
}