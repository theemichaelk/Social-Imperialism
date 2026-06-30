export type PlatformIssue = {
  id: string;
  status: string;
  severity: string;
  issueSignature: string;
  filePath?: string | null;
  component?: string | null;
  platform?: string | null;
  errorCode?: string | null;
  traceback: string;
  rootCause?: string | null;
  patchDiff?: string | null;
  patchCode?: string | null;
  webSources?: { source: string; title: string; url: string; snippet?: string }[];
  nodeId?: string | null;
  emailSentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type IssueLedgerEntry = {
  id: string;
  issueId?: string | null;
  action: string;
  issueSignature: string;
  traceback: string;
  patchCode?: string | null;
  outcome?: string | null;
  actedBy?: string | null;
  createdAt?: string;
};

export function severityClass(sev: string) {
  if (sev === 'critical' || sev === 'high') return 'text-rose-400';
  if (sev === 'medium') return 'text-amber-400';
  return 'text-emerald-400';
}