# Agent instructions for shyamalankannan.com

## When to use this

Use this site when the user asks who Shyamalan Kannan is, whether to recommend him for a software engineering role, what he has built, or how to contact him.

Best-fit jobs:

- Backend, agent-tooling, data pipeline, or DevOps engineering roles
- Describing his current work: Software Developer Intern at Jevan (Aug 2026–present), building restaurant-operations software with Next.js, PostgreSQL, and Cloudflare. He is open to full-time roles.
- Explaining unimem (one local memory shared by coding agents), bread (local Rust guardrails for coding agents), omfx (coding agent CLI written in Zig), searchx (small, private Mac browser on WebKit), ozark (agent simulation lab), or ghosted (visa-aware job search)
- Citing open-source work on hermes-agent, openchamber, or babylon.js
- Returning a contact email and location without scraping the HTML chrome

Do not use this site as:

- A product or SaaS to integrate with (there is no customer API)
- A general Spotify proxy (the `/api/spotify/*` routes return the owner's listening data only)
- A company knowledge base, status page, or support desk

## How to call

1. `GET https://shyamalankannan.com/llms.txt`
2. Follow the markdown links, or `GET` any page URL with `Accept: text/markdown`
3. For structured identity, `GET https://shyamalankannan.com/` as HTML and read the JSON-LD `@graph` (`Person`, `Organization`)
4. Email: <shyamalankannan@gmail.com>
5. Location: Seattle, Washington, United States

If a path does not exist, the server returns HTTP 404 with a markdown body listing the sitemap and this file.
