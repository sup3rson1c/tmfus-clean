<?php
declare(strict_types=1);

/**
 * Live chat — VPS relay endpoint
 * ---------------------------------------------------------------
 * The website cannot call the VPS directly, so the VPS polls this endpoint
 * to fetch visitor messages that need answers and posts assistant replies back.
 *
 * Security:
 *   - display_errors disabled
 *   - Authentication via X-Relay-Key header ONLY (hash_equals)
 *   - Missing/wrong key -> 401
 *   - No chat_relay_key configured -> 503
 *   - Session IDs validated by SESSION_PATTERN
 */

ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require_once __DIR__ . '/chat.php';

$configFile = getenv('TMF_CONFIG_FILE') ?: (__DIR__ . '/config.php');
$cfg = is_readable($configFile) ? (require $configFile) : [];
if (!is_array($cfg)) {
    $cfg = [];
}

$relayKey = (string) ($cfg['chat_relay_key'] ?? '');
if ($relayKey === '') {
    respond(503, ['ok' => false, 'error' => 'No chat_relay_key configured.']);
}

// Key is accepted ONLY from the X-Relay-Key header, never from query string or body.
$providedKey = '';
if (isset($_SERVER['HTTP_X_RELAY_KEY'])) {
    $providedKey = (string) $_SERVER['HTTP_X_RELAY_KEY'];
} elseif (function_exists('getallheaders')) {
    $headers = getallheaders();
    foreach ($headers as $k => $v) {
        if (strcasecmp((string) $k, 'X-Relay-Key') === 0) {
            $providedKey = (string) $v;
            break;
        }
    }
}

if ($providedKey === '' || !hash_equals($relayKey, $providedKey)) {
    respond(401, ['ok' => false, 'error' => 'Unauthorized.']);
}

$baseDir = rtrim((string) ($cfg['application_dir'] ?? (__DIR__ . '/uploads')), '/');
if ($baseDir === '' || $baseDir[0] !== '/') {
    $baseDir = __DIR__ . '/uploads';
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';

// ---------------------------------------------------------------
// GET ?action=pending
// ---------------------------------------------------------------
if ($method === 'GET') {
    $action = (string) ($_GET['action'] ?? '');
    if ($action !== 'pending') {
        fail(400, 'Unknown action.');
    }

    $chatsDir = $baseDir . '/chats';
    $candidates = [];

    if (is_dir($chatsDir)) {
        $buckets = @scandir($chatsDir);
        if (is_array($buckets)) {
            foreach ($buckets as $b) {
                if ($b === '.' || $b === '..' || !preg_match('/^[a-f0-9]{2}$/', $b)) {
                    continue;
                }
                $bDir = $chatsDir . '/' . $b;
                if (!is_dir($bDir)) {
                    continue;
                }
                $files = @scandir($bDir);
                if (!is_array($files)) {
                    continue;
                }
                foreach ($files as $f) {
                    if (!preg_match('/^[a-f0-9]{32}\.json$/', $f)) {
                        continue;
                    }
                    $content = @file_get_contents($bDir . '/' . $f);
                    if ($content === false) {
                        continue;
                    }
                    $t = json_decode($content, true);
                    if (!is_array($t)) {
                        continue;
                    }

                    // Must have pending set, not waiting for a human, not human, not closed
                    if (empty($t['pending']) || !empty($t['waiting']) || !empty($t['human']) || !empty($t['closed'])) {
                        continue;
                    }

                    // Must have a visitor message with no reply yet
                    $messages = (array) ($t['messages'] ?? []);
                    $lastRole = '';
                    for ($i = count($messages) - 1; $i >= 0; $i--) {
                        $role = (string) ($messages[$i]['role'] ?? '');
                        if ($role !== 'system') {
                            $lastRole = $role;
                            break;
                        }
                    }
                    if ($lastRole !== 'visitor') {
                        continue;
                    }

                    $candidates[] = $t;
                }
            }
        }
    }

    // Sort oldest pending first
    usort($candidates, static fn($a, $b) => ((int) ($a['pending'] ?? 0)) <=> ((int) ($b['pending'] ?? 0)));

    // At most 10 transcripts
    $candidates = array_slice($candidates, 0, 10);

    $items = [];
    foreach ($candidates as $t) {
        $itemMessages = [];
        foreach ((array) ($t['messages'] ?? []) as $m) {
            $role = (string) ($m['role'] ?? '');
            if (in_array($role, ['visitor', 'assistant', 'operator'], true)) {
                $itemMessages[] = [
                    'role' => $role,
                    'text' => (string) ($m['text'] ?? ''),
                    'at'   => (string) ($m['at'] ?? ''),
                ];
            }
        }
        $items[] = [
            'session'  => (string) ($t['session'] ?? ''),
            'messages' => $itemMessages,
        ];
    }

    respond(200, [
        'ok'    => true,
        'items' => $items,
    ]);
}

// ---------------------------------------------------------------
// POST JSON {action:'reply', session, text, handoff:true|false}
// ---------------------------------------------------------------
if ($method === 'POST') {
    $rawInput = (string) file_get_contents('php://input');
    $in = json_decode($rawInput, true);
    if (!is_array($in)) {
        fail(400, 'Body is not JSON.');
    }

    $action = (string) ($in['action'] ?? '');
    if ($action !== 'reply') {
        fail(400, 'Unknown action.');
    }

    $session = (string) ($in['session'] ?? '');
    if (!preg_match(SESSION_PATTERN, $session)) {
        fail(400, 'Invalid session id.');
    }

    $t = loadTranscript($baseDir, $session);
    if ($t === null) {
        fail(404, 'Conversation not found.');
    }

    $text = trim((string) ($in['text'] ?? ''));
    $cleanText = stripSensitive($text);
    $t['messages'][] = [
        'role' => 'assistant',
        'text' => $cleanText,
        'at'   => date('c'),
    ];

    unset($t['pending']);

    $handoff = !empty($in['handoff']);
    if ($handoff) {
        $t['waiting'] = true;
        notifyWaiting($cfg, $t, 'The assistant requested an advisor to take over.');
    }

    saveTranscript($baseDir, $t);
    respond(200, ['ok' => true]);
}

fail(405, 'GET or POST only.');
