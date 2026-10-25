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
  ['what-is-a-merchant-cash-advance', 'Guide: What is a merchant cash advance?'],
  ['mca-vs-sba-loan-vs-line-of-credit', 'Guide: MCA vs SBA loan vs line of credit'],
  ['what-funders-look-for-in-bank-statements', 'Guide: What funders look for in bank statements'],
  ['business-funding-with-bad-credit', 'Guide: Business funding with bad credit'],
  ['how-fast-can-a-business-get-funded', 'Guide: How fast can a business get funded?'],
  ['business-funding-broker-vs-lender', 'Guide: Broker vs lender'],
  ['business-funding-options', 'Guide: Business funding options'],
  ['how-to-get-a-small-business-loan', 'Guide: How to get a small business loan'],
  ['how-does-a-business-line-of-credit-work', 'Guide: How a business line of credit works'],
  ['what-is-a-cash-injection', 'Guide: What is a cash injection?'],
  ['working-capital-loans', 'Guide: Working capital loans'],
  ['how-to-get-an-sba-loan', 'Guide: How to get an SBA loan'],
  ['mca-consolidation', 'Guide: MCA consolidation'],
  ['business-funding-glossary', 'Guide: Business funding glossary'],
  ['heloc-for-business-owners', 'Guide: HELOC for business owners'],
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
