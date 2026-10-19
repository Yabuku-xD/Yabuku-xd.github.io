# Selected projects

Six things Shyamalan Kannan built on his own time.

## unimem: one memory for every coding agent

Oct 2026. One local memory that Claude Code, Codex, Cursor, and other agents share. It lives in a single SQLite file on your machine. An agent looks something up only when it is missing context, and it must give a reason, so a normal turn makes no lookup at all. A correction you give an agent becomes a memory only after you repeat it in a second session. One-off instructions never stick. With no LLM in the loop, it ranks the right conversation in the top 5 for 96% of LongMemEval-S questions. MIT licensed.

Stack: Python standard library · SQLite · MCP

- [Source on GitHub](https://github.com/Yabuku-xD/unimem)

## SearchX: a small, private browser for the Mac

Sep 2026. It runs on WebKit, the engine already inside macOS, so it ships no engine of its own. It is 12.6 MB on disk and opens its first window in 324 ms. A tab you leave alone for 30 minutes goes to sleep and frees its memory. SearchX applies the uBlock Origin filter lists inside the WebKit network layer, so the browser never requests a blocked ad. The WebKit blocker cannot run filters like `:has-text` or `:xpath`, so SearchX runs those itself. The new tab redraws any picture you pick as pixel art. MIT licensed.

Stack: Swift 6 · WebKit · macOS 14+

- [Download for Mac](https://github.com/Yabuku-xD/SearchX/releases/latest)
- [Source on GitHub](https://github.com/Yabuku-xD/SearchX)

## omfx: a coding agent in Zig

Aug 2026. His own coding agent CLI, about 3 MB. After every write it parses the file, and if the edit broke the syntax it rolls it back before the model is told it worked (36 languages). When the context window fills, older turns are compacted locally, not rewritten by an LLM, and dropped text stays available as citations. Supports 9 model providers and 27 built-in tools. MIT licensed.

Stack: Zig · Python · shell

- [Source on GitHub](https://github.com/Yabuku-xD/omfx)

## Bread: guardrails for coding agents

Ongoing. A Rust layer between a coding agent and your repo. It caps how much one file read or search can return, records where each piece of context came from, and refuses an edit if the file changed since the agent last read it. It also keeps a search index inside the workspace, for plain text and for code structure. Code, index, and optional vectors never leave the disk.

Stack: Rust · Codex CLI · tree-sitter · ripgrep-style search

- [Source on GitHub](https://github.com/Yabuku-xD/bread)

## Ozark: test lab for AI agents

May 2026. Runs an agent through adversarial scenarios on your own machine and scores it on five deployment-readiness checks. The Python side replays and diffs traces, checks guardrails, and tests live agents over HTTP or stdio.

Stack: Python · React 19 · Vite · SQLite (WAL)

- [Website](https://ozark-iota.vercel.app/)

## Ghosted: job search for visa holders

Mar 2026. Built while job hunting on a visa. It answers "does this company actually sponsor?" with 119k+ H-1B records, 23k+ company profiles, 9k+ salary entries, and 4.4k+ live listings. Celery and Redis workers pull from applicant tracking systems, drop duplicates, match listings to a resume with TF-IDF, and generate PDF reports.

Stack: Django · React · TypeScript · PostgreSQL · Redis · Celery

- [Source on GitHub](https://github.com/Yabuku-xD/Ghosted)
