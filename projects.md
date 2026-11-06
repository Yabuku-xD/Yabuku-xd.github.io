# Selected projects

Six things Shyamalan Kannan built on his own time.

## unimem: one memory for every coding agent

Oct 2026. One local memory server that Claude Code, Codex, Cursor, and other agents share. It lives in a single SQLite file on your machine, uses only the Python standard library, and makes no network calls. An agent looks something up only when it is missing context. It must give a reason for each lookup, and it gets back at most three memories, so a normal turn makes no lookup at all. A correction you give an agent becomes a memory only after you repeat it in a second session. MIT licensed.

Stack: Python standard library · SQLite · MCP

- [Source on GitHub](https://github.com/Yabuku-xD/unimem)

## Bread: guardrails for coding agents

Jul 2026. A local Rust tool between a coding agent and your repo. It caps how much one file read or search can return. It also refuses an edit if the file changed since the agent last read it. It indexes the workspace with tree-sitter, supports ripgrep-compatible search, and tags every piece of context with its source. Code, index, and optional vectors never leave the disk.

Stack: Rust · Codex CLI · tree-sitter · ripgrep-style search

- [Source on GitHub](https://github.com/Yabuku-xD/bread)

## omfx: a coding agent in Zig

Aug 2026. His own coding agent CLI. After every write it checks the file for syntax errors. If the edit broke the syntax, it rolls the edit back before the model is told it worked. When the context window fills, older turns are compacted locally instead of rewritten by an LLM. Dropped text stays available as citations. An allowlist blocks untrusted tool output by default. MIT licensed.

Stack: Zig · Python · shell

- [Source on GitHub](https://github.com/Yabuku-xD/omfx)

## SearchX: a small, private browser for the Mac

Sep 2026. It runs on WebKit, the engine already inside macOS, so it ships no engine of its own. A tab you leave alone for 30 minutes goes to sleep and frees its memory. SearchX applies the uBlock Origin filter lists inside the WebKit network layer, so the browser never requests a blocked ad. The WebKit blocker cannot run filters like `:has-text` or `:xpath`, so SearchX runs those itself. The new tab redraws any picture you pick as pixel art. MIT licensed.

Stack: Swift 6 · WebKit · macOS 14+

- [Download for Mac](https://github.com/Yabuku-xD/SearchX/releases/latest)
- [Source on GitHub](https://github.com/Yabuku-xD/SearchX)

## Ozark: test lab for AI agents

May 2026. Runs an agent through adversarial scenarios on your own machine and scores it before release. The Python side replays and diffs traces, checks guardrails, and tests live agents over HTTP or stdio.

Stack: Python · React 19 · Vite · SQLite (WAL)

- [Website](https://ozark-iota.vercel.app/)

## Ghosted: job search for visa holders

Mar 2026. Built while job hunting on a visa. It answers "does this company actually sponsor?" by joining H-1B records, company profiles, salary data, and live job listings. Celery and Redis workers pull from applicant tracking systems, drop duplicates, match listings to a resume with TF-IDF, and generate PDF reports.

Stack: Django · React · TypeScript · PostgreSQL · Redis · Celery

- [Source on GitHub](https://github.com/Yabuku-xD/Ghosted)

Open-source pull requests to Hermes Agent, OpenChamber, and Babylon.js: [contributions](https://shyamalankannan.com/contributions.md).
