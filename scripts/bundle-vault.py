#!/usr/bin/env python3
"""
Turn a folder of Obsidian notes into one file the chat assistant can read.

    python3 scripts/bundle-vault.py "C:/Users/you/Obsidian/TMF/public"
    python3 scripts/bundle-vault.py ~/Obsidian/TMF/public -o tmf-knowledge.md

It reads every .md file under that folder, strips the Obsidian-only
syntax that means nothing to a language model, and writes one tidy
markdown file. Then it tells you how big the result is and whether that
is still a sensible size to be sending on every message.

POINT IT AT A SUBFOLDER, NOT THE WHOLE VAULT
An assistant will read out anything put in front of it. Commission
splits, funder names, what you paid for a lead, notes on a particular
merchant — all of it is one question away from a stranger. Keep a
`public/` folder inside the vault holding only what you would be content
to see quoted back to you by a competitor, and point this at that.

This script helps but cannot save you: it scans for a few obvious
mistakes and warns, and it will refuse outright on an SSN. Everything
else is your judgement.

WHERE THE RESULT GOES
Upload it to the protected folder outside public_html that
application_dir points at, and put its full path in chat_knowledge_file
in api/config.php. Never inside public_html, and never committed — the
repo is public.
"""

import argparse
import io
import os
import re
import sys

# Windows consoles still default to a codepage that mangles a dash. The
# file itself is always written UTF-8; this is only about what is printed.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# ---------------------------------------------------------------
# Obsidian syntax that carries no meaning once the notes leave Obsidian.
# ---------------------------------------------------------------

# ![[some image.png]] or ![[note#section]] — an embed. The target is a
# file the model will never have, so the whole thing goes.
EMBED = re.compile(r'!\[\[[^\]]*\]\]')

# [[note]] or [[note|shown text]] — a wikilink. The link is meaningless
# outside the vault; the words are not, so the words stay.
WIKILINK = re.compile(r'\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]')

# %%comment%% — an Obsidian comment. Invisible when reading the note, so
# people put things in them they would not put in the note itself.
COMMENT = re.compile(r'%%.*?%%', re.S)

# ^block-id at the end of a line — an Obsidian block reference anchor.
BLOCK_ID = re.compile(r'\s*\^[A-Za-z0-9-]+\s*$', re.M)

# #tag — kept, but the hash goes, so it does not read as a heading.
TAG = re.compile(r'(?<!\w)#([a-zA-Z][\w/-]*)')

FRONTMATTER = re.compile(r'\A---\r?\n(.*?)\r?\n---\r?\n', re.S)

# ---------------------------------------------------------------
# Things that should not be leaving your vault.
# ---------------------------------------------------------------
REFUSE = [
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), 'what looks like a Social Security number'),
    (re.compile(r'\bsk-[A-Za-z0-9_-]{16,}'), 'what looks like an API key'),
    (re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'), 'what looks like an AWS key'),
    (re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'), 'a private key'),
]

# The starter notes leave blanks marked like this. Shipping one means the
# assistant reads "TO FILL IN: what happens at the weekend" out to a customer.
TODO = re.compile(r'^\s*TO FILL IN:', re.M | re.I)

WARN = [
    (re.compile(r'\bcommission|\bsplit\b|\bkickback|\brebate\b', re.I), 'commission or split'),
    (re.compile(r'\bfactor rate\b|\bbuy rate\b|\bsell rate\b', re.I), 'buy/sell or factor rates'),
    (re.compile(r'\bpassword\b|\bapi[ _-]?key\b|\bcredential', re.I), 'credentials'),
    (re.compile(r'\bdo not (?:tell|share|disclose)\b|\binternal only\b|\bconfidential\b', re.I),
     'a note marked internal or confidential'),
]


def parse_frontmatter(text):
    """Return (frontmatter dict, body). Only the keys we care about."""
    m = FRONTMATTER.match(text)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ':' not in line:
            continue
        k, _, v = line.partition(':')
        meta[k.strip().lower()] = v.strip().strip('"\'')
    return meta, text[m.end():]


def clean(text):
    text = COMMENT.sub('', text)
    text = EMBED.sub('', text)
    text = WIKILINK.sub(lambda m: (m.group(2) or m.group(1)).strip(), text)
    text = BLOCK_ID.sub('', text)
    text = TAG.sub(r'\1', text)
    # Obsidian callout markers read as noise without Obsidian to render them.
    text = re.sub(r'^>\s*\[!(\w+)\]\s*', r'> ', text, flags=re.M)
    # Collapse runs of blank lines.
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def restructure(body, title):
    """Make the note's headings nest under the title this bundle gives it.

    A note usually opens with its own `# Title`, and the bundle adds a
    `## Title` above it. Left alone that is the same heading twice, and
    every heading inside the note then outranks the note it belongs to.
    So the opening H1 goes, and everything below it moves down one level.
    """
    lines = body.splitlines()
    if lines and re.match(r'^#\s+', lines[0]):
        first = re.sub(r'^#\s+', '', lines[0]).strip()
        # Only drop it when it IS the title — a different H1 is real content.
        if first.lower() == title.lower():
            lines = lines[1:]
            while lines and not lines[0].strip():
                lines = lines[1:]

    # The bundle puts the note's title at level 2, so whatever the note's
    # own shallowest heading is has to land at level 3. Shift by that gap
    # rather than by a fixed amount: notes that start at H1 and notes that
    # start at H2 both need to end up in the same place.
    levels = [len(m.group(1)) for m in
              (re.match(r'^(#{1,6})\s+', l) for l in lines) if m]
    if not levels:
        return '\n'.join(lines).strip()
    shift = max(0, 3 - min(levels))

    out = []
    for line in lines:
        m = re.match(r'^(#{1,6})(\s+)', line)
        out.append(('#' * shift) + line if m else line)
    return '\n'.join(out).strip()


def title_for(path, meta, body):
    if meta.get('title'):
        return meta['title']
    m = re.search(r'^#\s+(.+)$', body, re.M)
    if m:
        return m.group(1).strip()
    return os.path.splitext(os.path.basename(path))[0]


def main():
    ap = argparse.ArgumentParser(
        description='Bundle an Obsidian folder into one file for the chat assistant.')
    ap.add_argument('folder', help='the folder of notes to include — a PUBLIC subfolder, not the whole vault')
    ap.add_argument('-o', '--out', default='tmf-knowledge.md', help='file to write (default: tmf-knowledge.md)')
    ap.add_argument('--force', action='store_true', help='bundle anyway despite refusals')
    args = ap.parse_args()

    root = os.path.abspath(os.path.expanduser(args.folder))
    if not os.path.isdir(root):
        sys.exit('There is no folder at: %s' % root)

    notes, skipped = [], []
    for dirpath, dirnames, filenames in os.walk(root):
        # Obsidian's own folders, and anything you have marked private.
        dirnames[:] = [d for d in dirnames
                       if not d.startswith('.') and d.lower() not in ('private', 'templates')]
        for name in sorted(filenames):
            if not name.lower().endswith('.md'):
                continue
            path = os.path.join(dirpath, name)
            raw = io.open(path, encoding='utf-8', errors='replace').read()
            meta, body = parse_frontmatter(raw)

            # `public: false` or `share: false` in the frontmatter keeps a
            # note out even when it sits in the public folder.
            if str(meta.get('public', '')).lower() in ('false', 'no'):
                skipped.append((path, 'marked public: false'))
                continue
            if str(meta.get('share', '')).lower() in ('false', 'no'):
                skipped.append((path, 'marked share: false'))
                continue

            body = clean(body)
            if not body:
                skipped.append((path, 'empty'))
                continue
            title = title_for(path, meta, body)
            body = restructure(body, title)
            notes.append((os.path.relpath(path, root), title, body))

    if not notes:
        sys.exit('No notes found in %s — is that the right folder?' % root)

    # ---- safety scan, before anything is written ----
    refusals, warnings, unfinished = [], [], []
    for rel, _title, body in notes:
        for pattern, what in REFUSE:
            if pattern.search(body):
                refusals.append((rel, what))
        for pattern, what in WARN:
            if pattern.search(body):
                warnings.append((rel, what))
        blanks = TODO.findall(body)
        if blanks:
            unfinished.append((rel, len(blanks)))

    if refusals and not args.force:
        print('STOPPED. These notes contain something that must not go to a chatbot:\n')
        for rel, what in refusals:
            print('  %-50s %s' % (rel, what))
        print('\nTake those notes out of the public folder and run this again.')
        print('If you are certain they are safe, re-run with --force.')
        sys.exit(2)

    # ---- write ----
    out = ['# TMF Team — reference notes',
           '',
           'Reference material for the TMF Team assistant. Generated from the vault;',
           'edit the notes, not this file.',
           '']
    for _rel, title, body in notes:
        out.append('## %s' % title)
        out.append('')
        out.append(body)
        out.append('')
    text = '\n'.join(out)

    io.open(args.out, 'w', encoding='utf-8').write(text)

    # ---- report ----
    words = len(text.split())
    chars = len(text)
    tokens = round(chars / 4)          # ~4 characters per token in English prose

    print('Wrote %s' % os.path.abspath(args.out))
    print('  %d notes, %d words, about %d tokens' % (len(notes), words, tokens))
    if skipped:
        print('  %d skipped:' % len(skipped))
        for path, why in skipped[:10]:
            print('      %-50s %s' % (os.path.relpath(path, root), why))
        if len(skipped) > 10:
            print('      ... and %d more' % (len(skipped) - 10))

    if unfinished:
        total = sum(n for _rel, n in unfinished)
        print('')
        print('%d note%s still unfinished — %d blank%s marked TO FILL IN:'
              % (len(unfinished), '' if len(unfinished) == 1 else 's',
                 total, '' if total == 1 else 's'))
        for rel, n in unfinished:
            print('  %-50s %d' % (rel, n))
        print('  The assistant reads those out word for word. Answer them, or')
        print('  delete the line, before you upload this.')

    if warnings:
        print('\nWorth a look before you upload this — these notes mention:')
        seen = set()
        for rel, what in warnings:
            if (rel, what) in seen:
                continue
            seen.add((rel, what))
            print('  %-50s %s' % (rel, what))
        print('  (not necessarily wrong, but a visitor could ask about any of it)')

    print('')
    if tokens < 20000:
        print('Size: comfortable. Every question sees all of these notes.')
    elif tokens < 60000:
        print('Size: getting large. It still works, but each message costs more and')
        print('the assistant gets vaguer as the notes grow. Worth trimming.')
    else:
        print('Size: too large to send whole on every message. Ask for the retrieval')
        print('version — it searches the notes and sends only what is relevant.')

    print('')
    print('Next: upload this file to the protected folder outside public_html (the')
    print('one application_dir points at), then set chat_knowledge_file in')
    print('api/config.php to its full path. Check it with:')
    print('  https://tmfus.com/api/chat.php?selftest=1')


if __name__ == '__main__':
    main()
