<?php
declare(strict_types=1);

/**
 * Opt-out endpoint — the one place an address goes to stop hearing from us
 * ------------------------------------------------------------------------
 * Serves three callers, and the difference between them is the whole point:
 *
 *   1. The form on /unsubscribe.html          POST, JSON body {email}
 *   2. RFC 8058 one-click, from Gmail/Yahoo   POST, body List-Unsubscribe=One-Click
 *   3. A person clicking the link in a mail   GET  → never suppresses, see below
 *
 * WHY GET NEVER SUPPRESSES
 * Mail clients and security scanners prefetch links in messages. If a GET
 * removed people, an anti-virus gateway crawling one campaign would silently
 * empty the list, and nobody would find out until the sends stopped working.
 * RFC 8058 is explicit about this: GET may show a page, only POST may act.
 * unsubscribe.html turns the GET into a confirming POST with one button.
 *
 * WHAT IT WRITES, per opt-out:
 *   <unsubscribe_dir>/suppression.jsonl   one JSON line, the durable record
 *   <unsubscribe_dir>/suppression.txt     one address per line, paste-ready
 *
 * The .txt exists because the operational job is pasting addresses into the
 * sending platform's block list. A file you can open and copy beats a file you
 * have to parse.
 *
 * WHAT IT DOES NOT DO
 * It does not tell the caller whether the address was on any list. Answering
 * that turns this into a free membership oracle for anyone who wants to test
 * whether you hold an address. Every well-formed request gets the same answer.
 *
 * Endpoint:  POST /api/unsubscribe.php
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');

const MAX_BODY      = 8192;
const RATE_PER_HOUR = 60;

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body);
    exit;
}

/* A GET is informational only. Point it at the page rather than 405-ing, so
   someone who pasted the URL into a browser bar still finds the form. */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    header('Location: /unsubscribe.html', true, 303);
    respond(303, ['ok' => true, 'info' => 'Use the form at /unsubscribe.html.']);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'POST only.']);
}

$cfg = is_readable(__DIR__ . '/config.php') ? (require __DIR__ . '/config.php') : [];

// ---------------------------------------------------------------
// Where the list lives
// ---------------------------------------------------------------
/* Same rule as application.php: a relative path resolves against this script
   and would put the suppression list inside public_html, where it is a
   downloadable list of email addresses. That is a data breach, so refuse. */
$dir = rtrim((string) ($cfg['unsubscribe_dir'] ?? ''), '/');
if ($dir === '' || $dir[0] !== '/') {
    error_log('unsubscribe.php: unsubscribe_dir must be an absolute path outside public_html. Refusing to write.');
    respond(503, ['ok' => false, 'error' => 'Opt-out storage is not configured. Email us and we will remove you by hand.']);
}
if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
    error_log('unsubscribe.php: cannot create ' . $dir);
    respond(503, ['ok' => false, 'error' => 'Opt-out storage is unavailable. Email us and we will remove you by hand.']);
}

// ---------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$rateFile = sys_get_temp_dir() . '/tmf_unsub_' . sha1($ip) . '.txt';
$hits = [];
if (is_readable($rateFile)) {
    $hits = array_filter(
        (array) json_decode((string) @file_get_contents($rateFile), true),
        static fn($t) => is_int($t) && $t > time() - 3600
    );
}
if (count($hits) >= RATE_PER_HOUR) {
    respond(429, ['ok' => false, 'error' => 'Too many requests from this connection. Try again later.']);
}
$hits[] = time();
@file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);

// ---------------------------------------------------------------
// Read the request. Two shapes arrive here.
// ---------------------------------------------------------------
$raw = (string) file_get_contents('php://input');
if (strlen($raw) > MAX_BODY) {
    respond(400, ['ok' => false, 'error' => 'Oversized body.']);
}

$email   = '';
$token   = '';
$channel = 'form';

/* Shape 1: RFC 8058 one-click. The mail provider posts a form-encoded body of
   exactly List-Unsubscribe=One-Click to whatever URL was in the header, so the
   address has to be carried in the query string as an opaque token. */
$isOneClick = str_contains($raw, 'List-Unsubscribe=One-Click')
    || (($_POST['List-Unsubscribe'] ?? '') === 'One-Click');

if ($isOneClick) {
    $channel = 'one-click';
    $token   = (string) ($_GET['t'] ?? '');
} else {
    // Shape 2: the form on unsubscribe.html, or any JSON caller.
    $in = json_decode($raw, true);
    if (is_array($in)) {
        $email = trim((string) ($in['email'] ?? ''));
        $token = trim((string) ($in['t'] ?? ''));
    } else {
        $email = trim((string) ($_POST['email'] ?? ''));
        $token = trim((string) ($_POST['t'] ?? ($_GET['t'] ?? '')));
    }
}

// ---------------------------------------------------------------
// Resolve a token to an address
// ---------------------------------------------------------------
/* Tokens are HMAC-wrapped so a URL cannot be edited into someone else's
   address, and so the raw address never sits in a link that ends up in
   referrer headers and server logs. Build them with:
   php -r "require 'api/config.php'; ..." — see SETUP-UNSUBSCRIBE.md. */
if ($token !== '') {
    $secret = (string) ($cfg['unsubscribe_secret'] ?? '');
    $parts  = explode('.', $token, 2);
    if ($secret !== '' && count($parts) === 2) {
        $payload = (string) base64_decode(strtr($parts[0], '-_', '+/'), true);
        $sig     = strtr($parts[1], '-_', '+/');
        $want    = base64_encode(hash_hmac('sha256', $payload, $secret, true));
        if (hash_equals(rtrim($want, '='), rtrim($sig, '='))) {
            $email = $payload;
        } else {
            error_log('unsubscribe.php: token signature did not verify');
        }
    }
}

$email = strtolower(trim($email));
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
    /* One-click has no second chance — there is no UI behind it — so log the
       failure loudly. A provider retrying against a broken token is the
       difference between an honoured opt-out and a complaint. */
    if ($isOneClick) {
        error_log('unsubscribe.php: one-click request arrived with no resolvable address');
        respond(400, ['ok' => false, 'error' => 'Could not identify the address.']);
    }
    respond(400, ['ok' => false, 'error' => 'That does not look like an email address.']);
}

// ---------------------------------------------------------------
// Record it
// ---------------------------------------------------------------
$record = [
    'email'    => $email,
    'at'       => gmdate('c'),
    'channel'  => $channel,
    'campaign' => substr(preg_replace('/[^A-Za-z0-9_\-]/', '', (string) ($_GET['c'] ?? '')) ?: '', 0, 60),
    'ip'       => $ip,
    'ua'       => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200),
];

$ok = @file_put_contents(
    $dir . '/suppression.jsonl',
    json_encode($record, JSON_UNESCAPED_SLASHES) . "\n",
    FILE_APPEND | LOCK_EX
);

/* The flat list is what gets pasted into the sending platform. Keep it unique
   so a person who clicks twice does not appear twice. */
$flat = $dir . '/suppression.txt';
$seen = is_readable($flat)
    ? array_flip(array_filter(array_map('trim', (array) file($flat))))
    : [];
if (!isset($seen[$email])) {
    @file_put_contents($flat, $email . "\n", FILE_APPEND | LOCK_EX);
}

if ($ok === false) {
    error_log('unsubscribe.php: could not write to ' . $dir);
    respond(503, ['ok' => false, 'error' => 'We could not record that. Please email us so we can remove you by hand.']);
}

// ---------------------------------------------------------------
// Tell the operator, because the list has to reach the sending platform
// ---------------------------------------------------------------
/* An opt-out recorded here is not yet an opt-out in the tool that does the
   sending. Until that gap is closed by hand, the notification is what closes
   it, so it is deliberately sent on every single request rather than batched. */
$notify = (string) ($cfg['unsubscribe_notify'] ?? '');
if ($notify !== '' && filter_var($notify, FILTER_VALIDATE_EMAIL)) {
    $from = (string) ($cfg['unsubscribe_from'] ?? 'no-reply@tmfus.com');
    @mail(
        $notify,
        'Opt-out: ' . $email,
        "An opt-out was recorded.\n\n"
        . "Address:  {$email}\n"
        . "When:     {$record['at']} UTC\n"
        . "Channel:  {$channel}\n"
        . "Campaign: " . ($record['campaign'] !== '' ? $record['campaign'] : '(not supplied)') . "\n\n"
        . "This is recorded on the server. It is NOT yet suppressed in the sending\n"
        . "platform. Add it to the global block list there, across every domain.\n"
        . "The legal clock is 10 business days; the mailbox providers expect 48 hours.\n",
        "From: {$from}\r\nContent-Type: text/plain; charset=utf-8\r\n"
    );
}

respond(200, ['ok' => true]);
