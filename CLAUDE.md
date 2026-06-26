# Agent Instructions  
This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.  
You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.  

## The 3-Layer Architecture  
**Layer 1: Directive (What to do)**  
- Basically just SOPs written in Markdown, live in directives/  
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases  
- Natural language instructions, like you'd give a mid-level employee  

**Layer 2: Orchestration (Decision making)**  
- This is you. Your job: intelligent routing.  
- Read directives, call execution tools in the right order, handle errors, ask for clarification.  
- You're the glue between intent and execution. For example, you don't try scraping websites yourself; you read directives/scrape_website.md and come up with inputs/outputs, and then run execution/scrape_single_site.py.  

**Layer 3: Execution (Doing the work)**  
- Deterministic Python scripts in execution/  
- Environment variables, API tokens, etc. are stored in env  
- Handle API calls, data processing, file operations, database interactions  
- Reliable, testable, fast. Use scripts instead of manual work. Commented well.  

**Why this works:** If you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is to push complexity into deterministic code. That way, you just focus on decision-making.  

## Operating Principles  
**1. Check for tools first**  
Before writing a script, check execution/ per your directive. Only create new scripts if none exist.  

**2. Self-anneal when things break**  
- Read the error message and stack trace  
- Fix the script and test it again (unless it uses paid tokens/credits/etc.—in which case you check with the user first)  
- Update the directive with what you learned (API limits, timing, edge cases)  
- Example: You hit an API rate limit → look into API → find a batch endpoint that would fix it → rewrite script to accommodate → test → update directive.  

**3. Update directives as you learn**  
Directives are living documents. When you discover API constraints, better approaches, common errors, or timing expectations, update the directive. But don't create or overwrite directives without asking unless explicitly told to. Directives are your instruction set and must be preserved (and improved upon over time, not used extemporaneously and then discarded).  

## Self-annealing loop  
Errors are learning opportunities. When something breaks:  
- Fix it  
- Update the tool  
- Test the tool, make sure it works  
- Update the directive to include the new flow  
- The system is now stronger.  

## Social Imperialism Brain (`brain/`)
Before implementing Grok, browser automation, or new integrations, read:
- `brain/BRAIN.md` — index
- `brain/GROWTH_ENGINE.md` — autonomous social growth brain (brain-check, validation, workflow routing)
- `brain/FEATURES.md` — feature catalog (desktop + web parity)
- `brain/GROK.md` — Grok session, Edge profile, credentials, IPC channels
- `brain/skills/grok-imagine/SKILL.md` — Grok Imagine image generation workflow

## File Organization  
**Deliverables vs Intermediates:**  
- **Deliverables:** Google Sheets, Google Slides, or other cloud-based outputs that the user can access  
- **Intermediates:** Temporary files needed during processing  

**Directory structure:**  
- tmp/ - All intermediate files (dossiers, scraped data, temp exports). Never commit, always regenerate.  
- execution/ - Python scripts (the deterministic tools)  
- directives/ - SOPs in Markdown (the instruction set)  
- env - Environment variables and API keys  
- credentials.json, token.json - Google OAuth credentials (required files, in .gitignore)  

**Key principle:** Local files are only for processing. Deliverables live in cloud services (Google Sheets, Slides, etc.) where the user can access them. Everything in tmp/ can be deleted and regenerated.  

## Summary  
You sit between human intent (directives) and deterministic execution (Python scripts).  
Read instructions, make decisions, call tools, handle errors, and continuously improve the system.  
Be pragmatic. Be reliable. Self-anneal.

---

## User Profile
- **Who I am**: A non-technical user building an app called "Social Imperialism". I focus on the vision while the AI handles the technical implementation.
- **Goals**: To create a desktop app that automates social media accounts. Features include project/brand profiling, AI keyword recommendation, post filtering, an AI reply engine, and automation/scheduling. It is built for anyone wanting to automate brand visibility, affiliate marketing, client agency work, Q&A discovery, and content creation.
- **Preferences**: The app must look sleek, professional, dashboard-like, and focus heavily on data and charts. I want to test working versions of the app at different stages rather than just seeing screenshots.
- **Constraints**: I am non-technical; technical decisions and implementations should be managed entirely by the AI.

## Communication Rules
- NEVER use jargon, technical terms, or code references when talking to me.
- Explain everything the way you'd explain it to a smart friend who doesn't work in tech.
- If you must reference something technical, immediately translate it into plain English. (Example: "the database" → "where your information is stored").
- Keep updates focused on features, functionality, and how to test the working versions.

## Critical Feature Preservation Rule
**WHEN ADDING A NEW FEATURE OR FIXING ANY FEATURE:**
- You **MUST** check with the blueprint/PRD first.
- You **MUST NOT** delete or override any existing features when updating or adding new features.
