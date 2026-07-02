# Social Imperialism Design Studio — Imperialism Design Compositor

**Domain:** socialimperialism.com `/design-studio`  
**Audit rule:** [AUDIT_ACCURACY_RULE.md](./AUDIT_ACCURACY_RULE.md)  
**Updated:** July 2026

Adapted from the Imperialism Center dual-render architecture for **social growth compositing** — not a standalone video NLE, but full feature parity mapped to Social Imperialism modules.

---

## Role and Execution Directive

You are implementing the **Imperialism Design Compositor** for Social Imperialism: production-grade layout engines, PII-safe publishing pipelines, and caption export for every connected social platform.

---

## Strict Compliance Rules

1. **Zero text duplication** — implement specs as operational IPC + UI, not marketing summaries.
2. **Complete scope** — programmatic render (`render-design-post`) + CSS compositor (`compose-social-layout`) + library + Grok + format intelligence.
3. **Fail-safe** — all compositor handlers return `{ success, error }`; PII scan before publish; validation in `_test-design-studio-features.js`.

---

## Section 1: Global Platform Architecture

```
                    +------------------------------+
                    |  Social Imperialism Web UI   |
                    |  /design-studio (Next.js)    |
                    +--------------+---------------+
                                   |
                                   v
                    +------------------------------+
                    |   SaaS IPC Bridge (API)      |
                    | packages/core/handlerRegistry|
                    +--------------+---------------+
                                   |
              +--------------------+--------------------+
              |                                         |
              v                                         v
+-----------------------------+           +-----------------------------+
| Programmatic Layout Engine  |           | HyperFrames CSS Compositor  |
| render-design-post          |           | compose-social-layout       |
| designStudioIpc.js          |           | designCompositor.js         |
+-----------------------------+           +-----------------------------+
```

### 1.1 Local-First Storage Core

| Capability | Implementation |
|------------|----------------|
| Design projects | `save-design-project` / `get-design-projects` — campaign-scoped store |
| Content library | `get-content-library` — shared assets across Create + Design |
| Cloud sync | Tenant PostgreSQL via Prisma jobs (WAL-style replication for jobs/assets) |

### 1.2 Multi-Agent Execution Kernel

| Capability | Implementation |
|------------|----------------|
| Template → render chain | `get-design-templates` → `render-design-post` |
| Format intelligence | `get-format-templates` → `recreate-from-format-template` |
| Atelier text-to-layout | `generate-atelier-layout` |
| Grok visuals | `grok-imagine` on design-studio page |

### 1.3 Dual-Core Hybrid Render Layer

| Engine | Channel | Role |
|--------|---------|------|
| Programmatic | `render-design-post` | Template slots → social post object |
| HyperFrames CSS | `compose-social-layout` | Aspect presets, blur bg, safe zones |
| Filters | `apply-design-filters` | Non-destructive tint/contrast stack |

---

## Section 2: Functional Core Feature Matrix

### 2.1 Social Asset Capture (mapped from multi-source capture)

| Feature | SI Implementation |
|---------|-------------------|
| Library import | Content Library images/video/copy |
| Grok Imagine | `GrokToolbar` on design-studio |
| Format study | `analyze-library-image` → saved formats |

### 2.2 Transcript-Driven Captions (mapped from transcript engine)

| Feature | SI Implementation |
|---------|-------------------|
| Word-level export | `export-design-subtitles` → VTT / SRT |
| Text trim | Template fields drive `render-design-post` caption |

### 2.3 Visual Compositor + Security (mapped from Rev + Screentelligence)

| Feature | SI Implementation |
|---------|-------------------|
| 16:9 → 9:16 Rev | `compose-social-layout` aspect presets |
| Safe zones | `safeZone`: center / top / bottom |
| PII redact | `scan-design-pii` — API keys, emails, cards |
| Filter chains | `apply-design-filters` |

### 2.4 Generative Media (mapped from Atelier + CLIP)

| Feature | SI Implementation |
|---------|-------------------|
| Atelier layouts | `generate-atelier-layout` |
| CLIP-style discovery | Content Library + `search-stock-photo` (Content Hub) |
| SVG / image gen | `generate-image` + Grok Imagine |

---

## Section 3: Schema (tenant PostgreSQL — design timelines)

```sql
CREATE TABLE design_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  aspect_ratio VARCHAR(10) DEFAULT '1:1',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE design_transcript_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES design_projects(id) ON DELETE CASCADE,
  start_time_ms INT NOT NULL,
  end_time_ms INT NOT NULL,
  word_text TEXT NOT NULL,
  is_redacted BOOLEAN DEFAULT FALSE
);
```

SaaS runtime uses campaign-scoped local store; schema above is the cloud backup target.

---

## IPC Channels (`/design-studio`)

| Channel | Purpose |
|---------|---------|
| `get-design-compositor-config` | Engines, aspects, filters, PII types |
| `compose-social-layout` | Aspect + safe zone + blur layout spec |
| `scan-design-pii` | Screentelligence text scan |
| `apply-design-filters` | Filter chain metadata |
| `generate-atelier-layout` | Text brief → template fields |
| `export-design-subtitles` | VTT / SRT export |
| `get-design-projects` / `save-design-project` | Local project persistence |
| `get-design-templates` | Built-in + custom templates |
| `render-design-post` | Final post generation |
| `get-format-templates` | Studied image formats |
| `recreate-from-format-template` | Brand recreation |

---

## Web UI

| Component | Path |
|-----------|------|
| Design Studio page | `apps/web/src/app/design-studio/page.tsx` |
| Compositor panel | `apps/web/src/components/DesignStudioCompositor.tsx` |
| Grok toolbar | `GrokToolbar` pageId=`design-studio` |

---

## Verification

```bash
node apps/api/_test-design-studio-features.js
API_URL=https://api.socialimperialism.com node apps/api/_test-qa-all-pages.js  # design-studio section
npm run audit:accuracy
```