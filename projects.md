# Selected projects

Four things Shyamalan Kannan built on his own time.

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
