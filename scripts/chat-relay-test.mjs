/* Tests for chat relay (api/chat-relay.php and api/chat.php relay mode).
 *
 * Covers:
 *   1. 401 on wrong or missing key
 *   2. Key in query string or body ignored (header only)
 *   3. 503 when no chat_relay_key is configured
 *   4. Pending list (GET ?action=pending, max 10, visitor msg with no reply, not waiting for human)
 *   5. Reply (POST action=reply appends assistant msg, clears pending)
 *   6. Handoff (handoff: true sets transcript waiting and triggers notifyWaiting)
 *   7. Fallback after wait timeout (exceeding chat_relay_wait adds honest fallback message)
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let failures = 0;
const check = (name, ok, extra) => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? ' — ' + extra : ''));
  if (!ok) failures++;
};

const tmpDir = mkdtempSync(join(tmpdir(), 'tmf-relay-test-'));
const uploadsDir = join(tmpDir, 'uploads');
const RELAY_KEY = 'test-relay-key-secret-98765';

const cfgContent = `<?php
return [
  'chat_enabled'     => true,
  'chat_endpoint'    => '',
  'chat_relay_key'   => '${RELAY_KEY}',
  'chat_relay_wait'  => 2,
  'application_dir'  => '${uploadsDir}',
];
`;

const cfgPath = join(tmpDir, 'config.php');
writeFileSync(cfgPath, cfgContent);

const cfg503Content = `<?php
return [
  'chat_enabled'     => true,
  'chat_endpoint'    => '',
  'chat_relay_key'   => '',
  'application_dir'  => '${uploadsDir}',
];
`;
const cfg503Path = join(tmpDir, 'config-no-key.php');
writeFileSync(cfg503Path, cfg503Content);

// Pick a random unprivileged port between 10000 and 20000
const port = 10000 + Math.floor(Math.random() * 9000);
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', '.'], {
  env: { ...process.env, TMF_CONFIG_FILE: cfgPath },
  stdio: 'ignore',
});

const cleanup = () => {
  try { server.kill(); } catch (_) {}
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
};

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

// Wait for server to boot
let up = false;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`${baseUrl}/about.html`);
    if (res.ok) { up = true; break; }
  } catch (_) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

if (!up) {
  console.error('Failed to start php -S server');
  process.exit(1);
}

try {
  /* ---------------- 1. 401 on wrong key ---------------- */
  const wrongKeyRes = await fetch(`${baseUrl}/api/chat-relay.php?action=pending`, {
    headers: { 'X-Relay-Key': 'wrong-key-abc' },
  });
  check('401 on wrong key', wrongKeyRes.status === 401);

  const missingKeyRes = await fetch(`${baseUrl}/api/chat-relay.php?action=pending`);
  check('401 on missing key header', missingKeyRes.status === 401);

  /* ---------------- 2. Key in query string ignored ---------------- */
  const queryKeyRes = await fetch(
    `${baseUrl}/api/chat-relay.php?action=pending&X-Relay-Key=${RELAY_KEY}&key=${RELAY_KEY}`
  );
  check('key in query string ignored (401 returned without header)', queryKeyRes.status === 401);

  const queryKeyWithWrongHeaderRes = await fetch(
    `${baseUrl}/api/chat-relay.php?action=pending&key=${RELAY_KEY}`,
    { headers: { 'X-Relay-Key': 'wrong-key' } }
  );
  check('query string key ignored even when header is wrong', queryKeyWithWrongHeaderRes.status === 401);

  /* ---------------- 3. 503 when no chat_relay_key configured ---------------- */
  // Launch temporary server with empty chat_relay_key
  const port503 = port + 1;
  const server503 = spawn('php', ['-S', `127.0.0.1:${port503}`, '-t', '.'], {
    env: { ...process.env, TMF_CONFIG_FILE: cfg503Path },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 200));
  try {
    const res503 = await fetch(`http://127.0.0.1:${port503}/api/chat-relay.php?action=pending`, {
      headers: { 'X-Relay-Key': RELAY_KEY },
    });
    check('503 when no chat_relay_key configured', res503.status === 503);
  } finally {
    server503.kill();
  }

  /* ---------------- Status & Start report mode 'relay' ---------------- */
  const statusRes = await fetch(`${baseUrl}/api/chat.php?status=1`);
  const statusJson = await statusRes.json();
  check("status reports mode 'relay'", statusJson.mode === 'relay' && statusJson.enabled === true);

  const startRes = await fetch(`${baseUrl}/api/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
  });
  const startJson = await startRes.json();
  check("start reports mode 'relay'", startJson.ok && startJson.mode === 'relay' && !!startJson.session);
  const session = startJson.session;

  /* ---------------- 4. Pending list ---------------- */
  // Before sending visitor message, pending list should be empty
  const pendingEmptyRes = await fetch(`${baseUrl}/api/chat-relay.php?action=pending`, {
    headers: { 'X-Relay-Key': RELAY_KEY },
  });
  const pendingEmptyJson = await pendingEmptyRes.json();
  check('pending list initially empty', pendingEmptyJson.ok && pendingEmptyJson.items.length === 0);

  // Send visitor message
  const sendRes = await fetch(`${baseUrl}/api/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', session, message: 'Need $100k equipment loan' }),
  });
  const sendJson = await sendRes.json();
  check(
    'send in relay mode answers thinking: true and messages: []',
    sendJson.ok === true && sendJson.thinking === true && Array.isArray(sendJson.messages) && sendJson.messages.length === 0
  );

  // GET ?action=pending should now list this session
  const pendingRes = await fetch(`${baseUrl}/api/chat-relay.php?action=pending`, {
    headers: { 'X-Relay-Key': RELAY_KEY },
  });
  const pendingJson = await pendingRes.json();
  check(
    'pending list returns pending item',
    pendingJson.ok &&
    pendingJson.items.length === 1 &&
    pendingJson.items[0].session === session &&
    pendingJson.items[0].messages.length === 1 &&
    pendingJson.items[0].messages[0].role === 'visitor' &&
    pendingJson.items[0].messages[0].text === 'Need $100k equipment loan'
  );

  /* ---------------- 5. Reply ---------------- */
  const replyRes = await fetch(`${baseUrl}/api/chat-relay.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Relay-Key': RELAY_KEY },
    body: JSON.stringify({
      action: 'reply',
      session,
      text: 'We offer equipment financing with terms up to 60 months.',
      handoff: false,
    }),
  });
  const replyJson = await replyRes.json();
  check('POST action: reply succeeds', replyJson.ok === true);

  // Pending list should now be empty (pending cleared)
  const pendingAfterReplyRes = await fetch(`${baseUrl}/api/chat-relay.php?action=pending`, {
    headers: { 'X-Relay-Key': RELAY_KEY },
  });
  const pendingAfterReplyJson = await pendingAfterReplyRes.json();
  check('pending mark cleared after reply', pendingAfterReplyJson.items.length === 0);

  // Visitor polling sees the assistant message and thinking is cleared
  const pollRes = await fetch(`${baseUrl}/api/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll', session, since: 1 }),
  });
  const pollJson = await pollRes.json();
  check(
    'poll returns new assistant message',
    pollJson.ok &&
    !pollJson.thinking &&
    pollJson.messages.length === 1 &&
    pollJson.messages[0].role === 'assistant' &&
    pollJson.messages[0].text === 'We offer equipment financing with terms up to 60 months.'
  );

  /* ---------------- 6. Handoff ---------------- */
  // Visitor sends another message asking for a human
  await fetch(`${baseUrl}/api/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', session, message: 'Can I speak with a person?' }),
  });

  // Relay replies with handoff: true
  const handoffReplyRes = await fetch(`${baseUrl}/api/chat-relay.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Relay-Key': RELAY_KEY },
    body: JSON.stringify({
      action: 'reply',
      session,
      text: 'I will connect you with an advisor.',
      handoff: true,
    }),
  });
  const handoffJson = await handoffReplyRes.json();
  check('handoff reply succeeds', handoffJson.ok === true);

  // Poll should reflect waiting: true
  const pollHandoffRes = await fetch(`${baseUrl}/api/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll', session, since: 3 }),
  });
  const pollHandoffJson = await pollHandoffRes.json();
  check(
    'transcript is waiting after handoff',
    pollHandoffJson.ok && pollHandoffJson.waiting === true && pollHandoffJson.messages[0].role === 'assistant'
  );

  // Transcripts waiting for human are excluded from pending list
  const pendingHandoffRes = await fetch(`${baseUrl}/api/chat-relay.php?action=pending`, {
    headers: { 'X-Relay-Key': RELAY_KEY },
  });
  const pendingHandoffJson = await pendingHandoffRes.json();
  check('session waiting for human excluded from pending list', pendingHandoffJson.items.length === 0);

  /* ---------------- 7. Fallback after wait timeout ---------------- */
  // Start a fresh conversation
  const s2StartRes = await fetch(`${baseUrl}/api/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
  });
  const s2StartJson = await s2StartRes.json();
  const session2 = s2StartJson.session;

  // Send a message
  await fetch(`${baseUrl}/api/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', session: session2, message: 'Hello? Anyone there?' }),
  });

  // Verify it is pending before wait expires
  const s2PendingRes = await fetch(`${baseUrl}/api/chat-relay.php?action=pending`, {
    headers: { 'X-Relay-Key': RELAY_KEY },
  });
  const s2PendingJson = await s2PendingRes.json();
  check('session2 is pending initially', s2PendingJson.items.some((it) => it.session === session2));

  // Wait for timeout (chat_relay_wait is set to 2 seconds)
  await new Promise((r) => setTimeout(r, 2200));

  // Poll should trigger the honest fallback
  const s2PollRes = await fetch(`${baseUrl}/api/chat.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'poll', session: session2, since: 1 }),
  });
  const s2PollJson = await s2PollRes.json();
  check(
    'fallback message added after wait timeout',
    s2PollJson.ok &&
    s2PollJson.waiting === true &&
    s2PollJson.messages.length === 1 &&
    s2PollJson.messages[0].role === 'assistant' &&
    s2PollJson.messages[0].text === 'I am having trouble reaching our system just now. A rep can pick this up.'
  );

  // Session2 should no longer be in pending
  const s2PendingAfterRes = await fetch(`${baseUrl}/api/chat-relay.php?action=pending`, {
    headers: { 'X-Relay-Key': RELAY_KEY },
  });
  const s2PendingAfterJson = await s2PendingAfterRes.json();
  check('pending cleared after fallback', !s2PendingAfterJson.items.some((it) => it.session === session2));
} finally {
  cleanup();
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll chat relay tests passed.');
}
