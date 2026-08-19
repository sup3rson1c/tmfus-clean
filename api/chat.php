<?php
declare(strict_types=1);

/**
 * Live chat — visitor side
 * ---------------------------------------------------------------
 * The widget on the site talks only to this file. This file talks to
 * John's Hermes agent. The visitor's browser never sees the agent URL
 * or the API key, because anything in page JavaScript is public and a
 * leaked key is someone else's bill.
 *
 * TWO MODES, ONE CONVERSATION
 * Normally the agent answers. The moment John takes the conversation
 * over from admin.php, `human` flips true and this file stops calling
 * the agent entirely — the visitor is now talking to a person, and a
 * bot interrupting that would be worse than useless. Releasing it hands
 * the conversation back.
 *
 * WHAT NEVER ENTERS A TRANSCRIPT
 * Anything shaped like a Social Security number is removed before the
 * message is stored, before it reaches the agent, and before John sees
 * it. Merchants do volunteer them, and a chat log is the last place one
 * should live. The visitor is told why.
 *
 * Endpoints (POST JSON, action in the body):
 *   start   -> { session }
 *   send    -> { messages: [...] }        visitor says something
 *   poll    -> { messages: [...], human } visitor listens for a reply
 *   human   -> { ok }                     visitor asks for a person
 *   details -> { ok }                     visitor leaves name/phone
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const MAX_MESSAGE     = 2000;
const MAX_TURNS       = 120;    // per conversation, then it is closed
const RATE_PER_MIN    = 20;     // messages per IP per minute
const AGENT_TIMEOUT   = 25;     // seconds
const SESSION_PATTERN = '/^[a-f0-9]{32}$/';

/** Sent to the agent when John has not written his own. */
const DEFAULT_SYSTEM_PROMPT = <<<'PROMPT'
You are the assistant on tmfus.com, the website of TMF Team, a US business
funding brokerage. You are talking to a business owner who is considering
applying for funding.

WHAT YOU DO
- Explain how business funding works: merchant cash advances, SBA 7(a) and 504
  loans, HELOCs, and what the application involves.
- Explain what TMF needs: four months of business bank statements, EIN,
  time in business, monthly revenue, ownership details.
- Explain the process and rough timelines: an advisor reviews the file, usually
  within 3 to 24 hours; on approval, funding can land in 24 to 48 hours.
- Help someone decide whether it is worth applying.

WHAT YOU NEVER DO
- Never quote a rate, an amount, an approval, or a probability of approval. You
  are not the underwriter and TMF would have to stand behind anything you say.
  If asked, say an advisor gives real numbers after looking at the statements.
- Never say the applicant is approved, pre-approved, or likely to be approved.
- Never ask for a Social Security number, date of birth, bank login, or card
  number. If one is offered, tell them not to send it in chat.
- Never invent TMF policy, fees, or terms you have not been told.
- Never claim to be human. If asked, say you are TMF's assistant and offer to
  bring in an advisor.

TONE
Short, plain, direct. No exclamation marks, no sales pressure. A business owner
asking about funding is usually under some pressure already; be calm and useful.

WHEN TO HAND OVER
If they ask for a person, ask about their specific situation in a way that needs
judgement, or seem frustrated, tell them you are bringing in an advisor and ask
for the best number to reach them.
PROMPT;

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body);
    exit;
}

function fail(int $code, string $message): void
{
    respond($code, ['ok' => false, 'error' => $message]);
}

/**
 * Remove anything that looks like a Social Security number.
 *
 * Deliberately eager. A false positive costs a merchant one retyped
 * order number; a false negative puts an SSN in a chat log forever.
 */
function stripSensitive(string $text, bool &$found = null): string
{
    $found = false;
    $patterns = [
        '/\b\d{3}[-–—\s.]\d{2}[-–—\s.]\d{4}\b/',   // 123-45-6789
        '/\b\d{9}\b/',                              // 123456789
        '/\b\d{3}\s?\d{2}\s?\d{4}\b/',              // 123 45 6789
    ];
    foreach ($patterns as $p) {
        $text = (string) preg_replace_callback($p, static function () use (&$found) {
            $found = true;
            return '[removed]';
        }, $text);
    }
    return $text;
}

function transcriptPath(string $baseDir, string $session): string
{
    return $baseDir . '/chats/' . substr($session, 0, 2) . '/' . $session . '.json';
}

function loadTranscript(string $baseDir, string $session): ?array
{
    $p = transcriptPath($baseDir, $session);
    if (!is_readable($p)) {
        return null;
    }
    $t = json_decode((string) @file_get_contents($p), true);
    return is_array($t) ? $t : null;
}

function saveTranscript(string $baseDir, array $t): bool
{
    $p = transcriptPath($baseDir, (string) $t['session']);
    $dir = dirname($p);
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return false;
    }
    @file_put_contents($baseDir . '/chats/.htaccess', "Require all denied\nOptions -Indexes\n");
    $t['updated'] = date('c');
    $ok = @file_put_contents($p, json_encode($t, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX) !== false;
    @chmod($p, 0600);
    return $ok;
}

/**
 * Ask the agent for a reply.
 *
 * Two request shapes, because "an agent endpoint" means different things
 * depending on who built it:
 *   openai  — POST {model, messages:[{role,content}]}, reply at
 *             choices[0].message.content. What most hosted model APIs speak.
 *   simple  — POST {session, message, history}, reply at `reply`.
 *             For a custom agent service of your own.
 * Set chat_format in config.php.
 */
function askAgent(array $cfg, array $transcript, string $latest): array
{
    $endpoint = (string) ($cfg['chat_endpoint'] ?? '');
    $key      = (string) ($cfg['chat_api_key'] ?? '');
    $format   = (string) ($cfg['chat_format'] ?? 'openai');
    $model    = (string) ($cfg['chat_model'] ?? '');
    $system   = trim((string) ($cfg['chat_system_prompt'] ?? '')) ?: DEFAULT_SYSTEM_PROMPT;

    if ($endpoint === '') {
        return ['ok' => false, 'error' => 'no chat_endpoint configured'];
    }

    $history = [];
    foreach ($transcript['messages'] as $m) {
        if ($m['role'] === 'visitor') {
            $history[] = ['role' => 'user', 'content' => $m['text']];
        } elseif ($m['role'] === 'assistant' || $m['role'] === 'operator') {
            // An operator's words are part of what the visitor has been told,
            // so the agent must see them to stay coherent after a handback.
            $history[] = ['role' => 'assistant', 'content' => $m['text']];
        }
    }

    if ($format === 'simple') {
        $payload = [
            'session' => $transcript['session'],
            'message' => $latest,
            'history' => $history,
            'system'  => $system,
        ];
    } else {
        $payload = [
            'model'    => $model !== '' ? $model : 'hermes',
            'messages' => array_merge([['role' => 'system', 'content' => $system]], $history),
            'max_tokens'  => (int) ($cfg['chat_max_tokens'] ?? 500),
            'temperature' => (float) ($cfg['chat_temperature'] ?? 0.4),
        ];
    }

    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    if ($key !== '') {
        $headerName = (string) ($cfg['chat_auth_header'] ?? 'Authorization');
        $prefix = (string) ($cfg['chat_auth_prefix'] ?? 'Bearer ');
        $headers[] = $headerName . ': ' . $prefix . $key;
    }

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => AGENT_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($body === false || $status < 200 || $status >= 300) {
        // Never log the key. Status and a short body excerpt are enough.
        error_log('chat.php: agent returned ' . $status . ' ' . $curlErr . ' ' . substr((string) $body, 0, 300));
        return ['ok' => false, 'error' => 'agent returned ' . $status];
    }

    $json = json_decode((string) $body, true);
    $reply = '';
    if (is_array($json)) {
        $reply = (string) ($json['choices'][0]['message']['content']
            ?? $json['reply']
            ?? $json['message']
            ?? $json['output']
            ?? '');
    }
    $reply = trim($reply);
    if ($reply === '') {
        error_log('chat.php: could not find a reply in the agent response: ' . substr((string) $body, 0, 300));
        return ['ok' => false, 'error' => 'empty reply'];
    }

    return ['ok' => true, 'reply' => $reply];
}

/* ---------------------------------------------------------------
   Boot
   --------------------------------------------------------------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'POST only.');
}

$cfg = is_readable(__DIR__ . '/config.php') ? (require __DIR__ . '/config.php') : [];
$baseDir = rtrim((string) ($cfg['application_dir'] ?? (__DIR__ . '/uploads')), '/');
if ($baseDir === '' || $baseDir[0] !== '/') {
    $baseDir = __DIR__ . '/uploads';
}

if (empty($cfg['chat_enabled'])) {
    fail(503, 'Chat is not switched on.');
}

$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) {
    fail(400, 'Body is not JSON.');
}
$action = (string) ($in['action'] ?? '');

/* Rate limit everything except polling, which is meant to be frequent. */
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
if ($action !== 'poll') {
    $rateFile = sys_get_temp_dir() . '/tmf_chat_' . sha1($ip) . '.txt';
    $hits = [];
    if (is_readable($rateFile)) {
        $hits = array_filter(
            (array) json_decode((string) @file_get_contents($rateFile), true),
            static fn($t) => is_int($t) && $t > time() - 60
        );
    }
    if (count($hits) >= RATE_PER_MIN) {
        fail(429, 'You are sending messages very quickly. Give it a moment.');
    }
    $hits[] = time();
    @file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);
}

/* ---------------------------------------------------------------
   start
   --------------------------------------------------------------- */
if ($action === 'start') {
    $session = bin2hex(random_bytes(16));
    $t = [
        'session'  => $session,
        'created'  => date('c'),
        'updated'  => date('c'),
        'ip'       => $ip,
        'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250),
        'page'     => substr((string) ($in['page'] ?? ''), 0, 200),
        'human'    => false,
        'waiting'  => false,
        'closed'   => false,
        'visitor'  => ['name' => '', 'phone' => '', 'email' => ''],
        'messages' => [],
    ];
    if (!saveTranscript($baseDir, $t)) {
        error_log('chat.php: could not write a transcript into ' . $baseDir . '/chats');
        fail(500, 'Chat is unavailable right now.');
    }
    respond(200, ['ok' => true, 'session' => $session]);
}

/* Everything below needs a real session. */
$session = (string) ($in['session'] ?? '');
if (!preg_match(SESSION_PATTERN, $session)) {
    fail(400, 'Unknown conversation.');
}
$t = loadTranscript($baseDir, $session);
if ($t === null) {
    fail(404, 'That conversation has expired. Please start a new one.');
}

/* ---------------------------------------------------------------
   poll — the visitor listening for anything new
   --------------------------------------------------------------- */
if ($action === 'poll') {
    $since = max(0, (int) ($in['since'] ?? 0));
    respond(200, [
        'ok'       => true,
        'human'    => (bool) $t['human'],
        'waiting'  => (bool) $t['waiting'],
        'total'    => count($t['messages']),
        'messages' => array_values(array_slice($t['messages'], $since)),
    ]);
}

/* ---------------------------------------------------------------
   human — "can I talk to someone"
   --------------------------------------------------------------- */
if ($action === 'human') {
    if (!$t['waiting'] && !$t['human']) {
        $t['waiting'] = true;
        $t['messages'][] = [
            'role' => 'system',
            'text' => 'Visitor asked for a person.',
            'at'   => date('c'),
        ];
        saveTranscript($baseDir, $t);

        $notify = (string) ($cfg['chat_notify'] ?? $cfg['application_notify'] ?? '');
        if ($notify !== '' && filter_var($notify, FILTER_VALIDATE_EMAIL)) {
            $v = $t['visitor'];
            @mail(
                $notify,
                'Someone is waiting in chat on tmfus.com',
                "A visitor has asked to speak to a person.\n\n"
                . 'Name:  ' . ($v['name'] ?: 'not given') . "\n"
                . 'Phone: ' . ($v['phone'] ?: 'not given') . "\n"
                . 'Email: ' . ($v['email'] ?: 'not given') . "\n"
                . 'Page:  ' . $t['page'] . "\n\n"
                . "Open the Live chat tab in your inbox to take it over:\n"
                . "https://tmfus.com/admin.php\n",
                "From: no-reply@tmfus.com\r\nContent-Type: text/plain; charset=utf-8\r\n"
            );
        }
    }
    respond(200, ['ok' => true]);
}

/* ---------------------------------------------------------------
   details — name and number, so a dropped chat is still reachable
   --------------------------------------------------------------- */
if ($action === 'details') {
    foreach (['name', 'phone', 'email'] as $k) {
        if (isset($in[$k]) && is_string($in[$k])) {
            $t['visitor'][$k] = substr(stripSensitive(trim($in[$k])), 0, 120);
        }
    }
    saveTranscript($baseDir, $t);
    respond(200, ['ok' => true]);
}

/* ---------------------------------------------------------------
   send
   --------------------------------------------------------------- */
if ($action !== 'send') {
    fail(400, 'Unknown action.');
}

if (!empty($t['closed']) || count($t['messages']) > MAX_TURNS) {
    respond(200, [
        'ok' => true,
        'messages' => [[
            'role' => 'assistant',
            'text' => 'This conversation has gone on a while — an advisor will pick it up from here. '
                    . 'If you leave your name and number we will call you back.',
            'at'   => date('c'),
        ]],
    ]);
}

$raw = trim((string) ($in['message'] ?? ''));
if ($raw === '') {
    fail(400, 'Empty message.');
}
if (mb_strlen($raw) > MAX_MESSAGE) {
    $raw = mb_substr($raw, 0, MAX_MESSAGE);
}

$sensitiveFound = false;
$text = stripSensitive($raw, $sensitiveFound);

$t['messages'][] = ['role' => 'visitor', 'text' => $text, 'at' => date('c')];

$out = [];

if ($sensitiveFound) {
    $warn = 'I have removed what looked like a Social Security number from that message — '
          . 'please do not send one in chat. You will enter it securely on the application form, '
          . 'or an advisor can take it by phone.';
    $t['messages'][] = ['role' => 'assistant', 'text' => $warn, 'at' => date('c')];
    $out[] = ['role' => 'assistant', 'text' => $warn, 'at' => date('c')];
}

/* If John is in the conversation, the agent stays out of it. */
if (!empty($t['human'])) {
    saveTranscript($baseDir, $t);
    respond(200, ['ok' => true, 'human' => true, 'messages' => $out]);
}

$answer = askAgent($cfg, $t, $text);

if ($answer['ok']) {
    $reply = stripSensitive((string) $answer['reply']);
    $t['messages'][] = ['role' => 'assistant', 'text' => $reply, 'at' => date('c')];
    $out[] = ['role' => 'assistant', 'text' => $reply, 'at' => date('c')];
} else {
    /* Say something true rather than nothing. A dead widget reads as a
       broken site; an honest one still captures the lead. */
    $fallback = 'I am having trouble reaching our system just now. An advisor can pick this up — '
              . 'leave your name and number and we will come back to you shortly.';
    $t['messages'][] = ['role' => 'assistant', 'text' => $fallback, 'at' => date('c')];
    $t['waiting'] = true;
    $out[] = ['role' => 'assistant', 'text' => $fallback, 'at' => date('c')];
}

saveTranscript($baseDir, $t);
respond(200, ['ok' => true, 'human' => false, 'messages' => $out]);
