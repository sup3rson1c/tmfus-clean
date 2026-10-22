// Writes llms-full.txt: every question and answer already published in the
// FAQPage markup of the built pages, grouped by page. One source of truth —
// the site's own JSON-LD — so the AI-readable copy cannot drift from the pages.
// Run after `node build.mjs`:  node tools/gen-llms-full.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const PAGES = [
  ['index', 'Home'],
  ['mca', 'Merchant cash advance'],
  ['sba-loans', 'SBA 7(a) and 504 loans'],
  ['heloc-calculator', 'Home equity line of credit'],
  ['line-of-credit', 'Line of credit'],
  ['funding-estimator', 'Cash injection calculator'],
];

const out = [
  '# TMF Team: full question and answer text',
  '',
  '> Every question and answer published on tmfus.com, copied from the pages',
  '> themselves. TMF Team is a business funding brokerage, not a lender. Figures',
  '> are estimates, not offers. Short version: https://tmfus.com/llms.txt',
  '',
];

for (const [slug, title] of PAGES) {
  const html = readFileSync(`${slug}.html`, 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const qa = [];
  for (const b of blocks) {
    let data;
    try { data = JSON.parse(b[1]); } catch { continue; }
    for (const node of [].concat(data['@graph'] || data)) {
      if (node['@type'] !== 'FAQPage') continue;
      for (const q of node.mainEntity || []) qa.push([q.name, q.acceptedAnswer?.text || '']);
    }
  }
  if (!qa.length) continue;
  const url = slug === 'index' ? 'https://tmfus.com/' : `https://tmfus.com/${slug}`;
  out.push(`## ${title}`, '', `Source: ${url}`, '');
  for (const [q, a] of qa) {
    out.push(`### ${q}`, '', a.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), '');
  }
}

writeFileSync('llms-full.txt', out.join('\n'));
console.log(`llms-full.txt: ${out.length} lines`);
