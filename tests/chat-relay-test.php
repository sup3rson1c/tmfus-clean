<?php
declare(strict_types=1);

/**
 * Chat Relay test runner
 * Tests:
 *   1. 401 on wrong key
 *   2. Key in query string ignored (header only)
 *   3. 503 when no chat_relay_key configured
 *   4. Pending list
 *   5. Reply
 *   6. Handoff
 *   7. Fallback after wait timeout
 */

$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$tmpDir = sys_get_temp_dir() . '/tmf_relay_test_' . bin2hex(random_bytes(8));
mkdir($tmpDir, 0700, true);
$uploadsDir = $tmpDir . '/uploads';
mkdir($uploadsDir, 0700, true);

$relayKey = 'test-relay-key-secret-98765';
$cfgPath = $tmpDir . '/config.php';
file_put_contents($cfgPath, "<?php\nreturn [\n  'chat_enabled' => true,\n  'chat_endpoint' => '',\n  'chat_relay_key' => '{$relayKey}',\n  'chat_relay_wait' => 2,\n  'application_dir' => '{$uploadsDir}',\n];\n");

$port = 10000 + random_int(1000, 9000);
$cmd = sprintf('exec php -S 127.0.0.1:%d -t %s', $port, escapeshellarg(realpath(__DIR__ . '/..')));
$env = array_merge($_ENV, ['TMF_CONFIG_FILE' => $cfgPath]);
$proc = proc_open($cmd, $descriptors, $pipes, realpath(__DIR__ . '/..'), $env);

register_shutdown_function(static function () use ($proc, $tmpDir) {
    if (is_resource($proc)) {
        proc_terminate($proc);
    }
    // Cleanup files in tmpDir
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($tmpDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        @$todo($fileinfo->getRealPath());
    }
    @rmdir($tmpDir);
});

// Wait for server boot
$up = false;
$baseUrl = "http://127.0.0.1:{$port}";
for ($i = 0; $i < 30; $i++) {
    usleep(100000);
    $ctx = stream_context_create(['http' => ['timeout' => 1, 'ignore_errors' => true]]);
    $res = @file_get_contents($baseUrl . '/about.html', false, $ctx);
    if ($res !== false) {
        $up = true;
        break;
    }
}

if (!$up) {
    fwrite(STDERR, "Failed to start PHP test server\n");
    exit(1);
}

function req(string $url, string $method = 'GET', array $headers = [], ?string $body = null): array
{
    $headerLines = [];
    foreach ($headers as $k => $v) {
        $headerLines[] = "{$k}: {$v}";
    }
    $opts = [
        'http' => [
            'method'        => $method,
            'header'        => implode("\r\n", $headerLines),
            'content'       => $body,
            'ignore_errors' => true,
            'timeout'       => 5,
        ],
    ];
    $ctx = stream_context_create($opts);
    $content = (string) @file_get_contents($url, false, $ctx);
    $statusLine = $http_response_header[0] ?? '';
    preg_match('{HTTP\/\S*\s(\d{3})}', $statusLine, $m);
    $status = isset($m[1]) ? (int) $m[1] : 0;
    $json = json_decode($content, true);
    return ['status' => $status, 'json' => $json, 'raw' => $content];
}

$failures = 0;
function chk(string $name, bool $ok, string $extra = ''): void
{
    global $failures;
    printf("  %s %s%s\n", $ok ? '✓' : '✗', $name, $extra !== '' ? " — {$extra}" : '');
    if (!$ok) {
        $failures++;
    }
}

echo "Running PHP Chat Relay tests...\n";

// 1. 401 on wrong key
$r = req($baseUrl . '/api/chat-relay.php?action=pending', 'GET', ['X-Relay-Key' => 'wrong-key']);
chk('401 on wrong key', $r['status'] === 401);

$r = req($baseUrl . '/api/chat-relay.php?action=pending', 'GET');
chk('401 on missing key header', $r['status'] === 401);

// 2. Key in query string ignored
$r = req($baseUrl . '/api/chat-relay.php?action=pending&key=' . $relayKey . '&X-Relay-Key=' . $relayKey, 'GET');
chk('key in query string ignored', $r['status'] === 401);

// 3. 503 when no key configured
$cfgNoKey = $tmpDir . '/config_nokey.php';
file_put_contents($cfgNoKey, "<?php\nreturn ['chat_enabled' => true, 'chat_relay_key' => '', 'application_dir' => '{$uploadsDir}'];\n");
$port2 = $port + 1;
$cmd2 = sprintf('exec php -S 127.0.0.1:%d -t %s', $port2, escapeshellarg(realpath(__DIR__ . '/..')));
$env2 = array_merge($_ENV, ['TMF_CONFIG_FILE' => $cfgNoKey]);
$proc2 = proc_open($cmd2, $descriptors, $pipes, realpath(__DIR__ . '/..'), $env2);
usleep(200000);
$r = req("http://127.0.0.1:{$port2}/api/chat-relay.php?action=pending", 'GET', ['X-Relay-Key' => $relayKey]);
proc_terminate($proc2);
chk('503 when no chat_relay_key configured', $r['status'] === 503);

// Status & Start mode relay
$r = req($baseUrl . '/api/chat.php?status=1');
chk("status reports mode 'relay'", ($r['json']['mode'] ?? '') === 'relay');

$r = req($baseUrl . '/api/chat.php', 'POST', ['Content-Type' => 'application/json'], json_encode(['action' => 'start']));
chk("start reports mode 'relay'", ($r['json']['mode'] ?? '') === 'relay' && !empty($r['json']['session']));
$session = (string) ($r['json']['session'] ?? '');

// 4. Pending list
$r = req($baseUrl . '/api/chat-relay.php?action=pending', 'GET', ['X-Relay-Key' => $relayKey]);
chk('pending list initially empty', $r['status'] === 200 && empty($r['json']['items']));

$r = req($baseUrl . '/api/chat.php', 'POST', ['Content-Type' => 'application/json'], json_encode([
    'action'  => 'send',
    'session' => $session,
    'message' => 'Need 75k line of credit',
]));
chk('send in relay mode answers thinking: true', ($r['json']['thinking'] ?? false) === true && empty($r['json']['messages']));

$r = req($baseUrl . '/api/chat-relay.php?action=pending', 'GET', ['X-Relay-Key' => $relayKey]);
chk(
    'pending list includes visitor message',
    $r['status'] === 200 &&
    count($r['json']['items'] ?? []) === 1 &&
    ($r['json']['items'][0]['session'] ?? '') === $session &&
    ($r['json']['items'][0]['messages'][0]['text'] ?? '') === 'Need 75k line of credit'
);

// 5. Reply
$r = req($baseUrl . '/api/chat-relay.php', 'POST', ['Content-Type' => 'application/json', 'X-Relay-Key' => $relayKey], json_encode([
    'action'  => 'reply',
    'session' => $session,
    'text'    => 'Lines of credit are available up to $100k.',
    'handoff' => false,
]));
chk('POST reply succeeds', ($r['json']['ok'] ?? false) === true);

$r = req($baseUrl . '/api/chat-relay.php?action=pending', 'GET', ['X-Relay-Key' => $relayKey]);
chk('pending cleared after reply', empty($r['json']['items']));

$r = req($baseUrl . '/api/chat.php', 'POST', ['Content-Type' => 'application/json'], json_encode([
    'action'  => 'poll',
    'session' => $session,
    'since'   => 1,
]));
chk('poll returns assistant reply', count($r['json']['messages'] ?? []) === 1 && ($r['json']['messages'][0]['role'] ?? '') === 'assistant');

// 6. Handoff
req($baseUrl . '/api/chat.php', 'POST', ['Content-Type' => 'application/json'], json_encode([
    'action'  => 'send',
    'session' => $session,
    'message' => 'Connect me to an advisor please',
]));
$r = req($baseUrl . '/api/chat-relay.php', 'POST', ['Content-Type' => 'application/json', 'X-Relay-Key' => $relayKey], json_encode([
    'action'  => 'reply',
    'session' => $session,
    'text'    => 'An advisor is joining shortly.',
    'handoff' => true,
]));
chk('handoff reply succeeds', ($r['json']['ok'] ?? false) === true);

$r = req($baseUrl . '/api/chat.php', 'POST', ['Content-Type' => 'application/json'], json_encode([
    'action'  => 'poll',
    'session' => $session,
    'since'   => 3,
]));
chk('transcript waiting is true after handoff', ($r['json']['waiting'] ?? false) === true);

$r = req($baseUrl . '/api/chat-relay.php?action=pending', 'GET', ['X-Relay-Key' => $relayKey]);
chk('waiting session excluded from pending list', empty($r['json']['items']));

// 7. Fallback after wait
$r = req($baseUrl . '/api/chat.php', 'POST', ['Content-Type' => 'application/json'], json_encode(['action' => 'start']));
$session2 = (string) ($r['json']['session'] ?? '');
req($baseUrl . '/api/chat.php', 'POST', ['Content-Type' => 'application/json'], json_encode([
    'action'  => 'send',
    'session' => $session2,
    'message' => 'Waiting for answer...',
]));

$r = req($baseUrl . '/api/chat-relay.php?action=pending', 'GET', ['X-Relay-Key' => $relayKey]);
chk('session2 pending before wait', count($r['json']['items'] ?? []) === 1);

// Wait for timeout
usleep(2200000);

$r = req($baseUrl . '/api/chat.php', 'POST', ['Content-Type' => 'application/json'], json_encode([
    'action'  => 'poll',
    'session' => $session2,
    'since'   => 1,
]));
chk(
    'fallback message added after wait timeout',
    ($r['json']['waiting'] ?? false) === true &&
    count($r['json']['messages'] ?? []) === 1 &&
    str_contains($r['json']['messages'][0]['text'] ?? '', 'trouble reaching our system')
);

$r = req($baseUrl . '/api/chat-relay.php?action=pending', 'GET', ['X-Relay-Key' => $relayKey]);
chk('session2 pending cleared after fallback', empty($r['json']['items']));

if ($failures > 0) {
    echo "\n{$failures} test(s) failed.\n";
    exit(1);
}
echo "\nAll PHP chat relay tests passed.\n";
exit(0);
