import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(name) {
  return readFileSync(join(ROOT, name), "utf8");
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

test("homepage has complete metadata signals", () => {
  const html = read("index.html");
  assert.match(html, /<html lang="en"/);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/shyamalankannan\.com\/"/,
  );
  assert.match(html, /property="og:image"/);
  assert.match(html, /property="og:type"/);
});

test("homepage JSON-LD includes Person and Organization identity", () => {
  const html = read("index.html");
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, "JSON-LD script is missing");
  const data = JSON.parse(match[1]);
  const graph = data["@graph"] || [];
  const person = graph.find((node) => node["@type"] === "Person");
  const org = graph.find((node) => node["@type"] === "Organization");
  assert.equal(person.name, "Shyamalan Kannan");
  assert.equal(person.url, "https://shyamalankannan.com/");
  assert.ok(person.sameAs.length >= 1);
  assert.equal(org.name, "Shyamalan Kannan");
  assert.equal(org.contactPoint.email, "shyamalankannan@gmail.com");
  assert.equal(org.contactPoint.contactType, "professional");
  assert.equal(org.address["@type"], "PostalAddress");
  assert.equal(org.address.addressLocality, "Seattle");
});

test("homepage is readable without JavaScript and has heading hierarchy", () => {
  const html = read("index.html");
  const text = visibleText(html);
  assert.match(html, /<h1\b/i);
  assert.match(html, /<h2\b/i);
  assert.match(html, /<h3\b/i);
  assert.ok(text.length >= 500, `expected 500+ chars, got ${text.length}`);
});

test("homepage content is at least 5% of the HTML", () => {
  const html = read("index.html");
  const text = visibleText(html);
  const ratio = text.length / html.length;
  assert.ok(
    ratio >= 0.05,
    `content efficiency ${((ratio * 100).toFixed(2))}% is below 5% (${text.length} chars in ${html.length} bytes)`,
  );
});

test("trust pages have at least 500 characters of content", () => {
  for (const file of ["about-me.html", "contact.html", "privacy.html"]) {
    const text = visibleText(read(file));
    assert.ok(
      text.length >= 500,
      `${file} has ${text.length} visible chars, need 500+`,
    );
  }
});

test("llms.txt follows the spec and includes when-to-use guidance", () => {
  const llms = read("llms.txt");
  assert.match(llms, /^# Shyamalan Kannan/m);
  assert.match(llms, /^>/m);
  assert.match(llms, /When to use this/);
  assert.match(llms, /How an agent should call this site/);
  assert.match(llms, /^## Pages/m);
  assert.ok(llms.length >= 100);
});

test("agent-instructions.md names jobs and how to call the site", () => {
  const doc = read("agent-instructions.md");
  assert.match(doc, /When to use this/);
  assert.match(doc, /How to call/);
  assert.match(doc, /shyamalankannan@gmail.com/);
});

test("sitemap.xml lists indexable URLs with lastmod", () => {
  const xml = read("sitemap.xml");
  assert.match(xml, /<urlset /);
  for (const loc of [
    "https://shyamalankannan.com/",
    "https://shyamalankannan.com/about",
    "https://shyamalankannan.com/contact",
    "https://shyamalankannan.com/privacy",
    "https://shyamalankannan.com/projects.html",
  ]) {
    assert.ok(xml.includes(`<loc>${loc}</loc>`), `missing ${loc}`);
  }
  assert.match(xml, /<lastmod>2026-08-21<\/lastmod>/);
});

test("markdown twins exist for public pages", () => {
  for (const file of [
    "index.md",
    "about.md",
    "about-me.md",
    "contact.md",
    "privacy.md",
    "projects.md",
    "contributions.md",
    "spotify.md",
  ]) {
    const body = read(file);
    assert.ok(body.startsWith("#"), `${file} should start with an H1`);
    assert.ok(body.length > 80, `${file} is too short`);
  }
});
