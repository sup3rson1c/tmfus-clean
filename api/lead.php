<?php
declare(strict_types=1);

/**
 * Submission capture — everything a visitor sends, kept on your server
 * ---------------------------------------------------------------
 * Every form on the site posts here as well as to the Google Sheet:
 * the cash-injection calculator, the HELOC calculator, the contact
 * form, and the application's non-sensitive summary.
 *
 * WHY THIS EXISTS
 * The Google Sheets endpoint is posted no-cors, so the browser cannot
 * read the response and nobody can tell a delivered lead from a lost
 * one. This endpoint answers properly, writes to disk you control, and
 * is not one Google outage or one revoked Apps Script away from losing
 * a month of enquiries. The Sheet stays — this is a second copy, not a
 * replacement.
 *
 * WHAT IT WRITES, per submission:
 *   <application_dir>/leads/YYYY-MM/<time>_<kind>_<id>.json   full record
 *   <application_dir>/leads/YYYY-MM/leads.csv                 one row, opens in Excel
 *
 * WHAT IT REFUSES TO WRITE
 * Anything whose key looks like an SSN, date of birth or signature.
 * Those belong only inside the encrypted application envelope written
 * by application.php. If they arrive here they are dropped, and the
 * drop is logged so the mistake is visible rather than silent.
 *
 * Endpoint:  POST /api/lead.php   (application/json or text/plain JSON)
 *   { kind, page, submittedAt, referrer, data: { ... } }
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const MAX_BODY       = 262144;   // 256 KB
const RATE_PER_HOUR  = 60;
const MAX_FIELDS     = 80;
const MAX_VALUE_LEN  = 2000;

/** Never stored here. These live only in the encrypted application. */
const SENSITIVE_KEYS = ['ssn', 'dob', 'birth', 'social', 'signature', 'sig'];

/** Columns the CSV always has, in this order. Everything else goes to `details`. */
const CSV_COLUMNS = [
    'received', 'kind', 'page', 'first', 'last', 'business',
    'email', 'phone', 'state', 'reference',
];

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body);
    exit;
}

function isSensitiveKey(string $key): bool
{
    $lower = strtolower($key);
    foreach (SENSITIVE_KEYS as $bad) {
        if (str_contains($lower, $bad)) {
            return true;
        }
    }
    return false;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'POST only.']);
}

$cfg = is_readable(__DIR__ . '/config.php') ? (require __DIR__ . '/config.php') : [];
$baseDir = rtrim((string) ($cfg['application_dir'] ?? (__DIR__ . '/uploads')), '/');

/* A relative application_dir resolves against this script's directory, which
   silently puts the lead store inside the web root. Unlike application.php
   this endpoint does not refuse — losing someone's enquiry is worse than
   storing it in the fallback — but it does not honour the bad path either. */
if ($baseDir === '' || $baseDir[0] !== '/') {
    error_log('lead.php: application_dir is relative (' . $baseDir . ') — using the protected fallback instead. Fix it to an absolute path.');
    $baseDir = __DIR__ . '/uploads';
}

// ---------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$rateFile = sys_get_temp_dir() . '/tmf_lead_' . sha1($ip) . '.txt';
$hits = [];
if (is_readable($rateFile)) {
    $hits = array_filter(
        (array) json_decode((string) @file_get_contents($rateFile), true),
        static fn($t) => is_int($t) && $t > time() - 3600
    );
}
if (count($hits) >= RATE_PER_HOUR) {
    respond(429, ['ok' => false, 'error' => 'Too many submissions from this connection.']);
}
$hits[] = time();
@file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);

// ---------------------------------------------------------------
// Body
// ---------------------------------------------------------------
$raw = (string) file_get_contents('php://input');
if ($raw === '' || strlen($raw) > MAX_BODY) {
    respond(400, ['ok' => false, 'error' => 'Empty or oversized body.']);
}

$in = json_decode($raw, true);
if (!is_array($in)) {
    respond(400, ['ok' => false, 'error' => 'Body is not JSON.']);
}

$kind = preg_replace('/[^a-z0-9-]/i', '', (string) ($in['kind'] ?? 'unknown')) ?: 'unknown';
$kind = substr($kind, 0, 40);

$data = is_array($in['data'] ?? null) ? $in['data'] : [];

$clean = [];
$dropped = [];
$n = 0;
foreach ($data as $k => $v) {
    if (!is_string($k) || is_array($v) || $n >= MAX_FIELDS) {
        continue;
    }
    $key = substr((string) preg_replace('/[^a-z0-9_]/i', '', $k), 0, 40);
    if ($key === '') {
        continue;
    }
    if (isSensitiveKey($key)) {
        $dropped[] = $key;
        continue;
    }
    $clean[$key] = substr((string) $v, 0, MAX_VALUE_LEN);
    $n++;
}

if ($dropped !== []) {
    // Loud on purpose: something upstream is sending what it must not.
    error_log('lead.php: dropped sensitive keys from a ' . $kind . ' submission: ' . implode(', ', $dropped));
}

// ---------------------------------------------------------------
// Write
// ---------------------------------------------------------------
$month = date('Y-m');
$dir = $baseDir . '/leads/' . $month;
if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
    error_log('lead.php: could not create ' . $dir);
    respond(500, ['ok' => false, 'error' => 'Could not store the submission.']);
}
@file_put_contents($baseDir . '/leads/.htaccess', "Require all denied\nOptions -Indexes\n");
@file_put_contents($baseDir . '/leads/index.html', '');

$id = strtoupper(bin2hex(random_bytes(3)));
$record = [
    'id'          => $id,
    'kind'        => $kind,
    'received'    => date('c'),
    'page'        => substr((string) ($in['page'] ?? ''), 0, 200),
    'referrer'    => substr((string) ($in['referrer'] ?? ''), 0, 300),
    'submittedAt' => substr((string) ($in['submittedAt'] ?? ''), 0, 40),
    'ip'          => $ip,
    'user_agent'  => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
    'data'        => $clean,
];

$file = $dir . '/' . date('d_His') . '_' . $kind . '_' . $id . '.json';
if (@file_put_contents($file, json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
    error_log('lead.php: could not write ' . $file);
    respond(500, ['ok' => false, 'error' => 'Could not store the submission.']);
}
@chmod($file, 0600);

// ---------------------------------------------------------------
// CSV, so the whole month opens in Excel with one download.
// ---------------------------------------------------------------
$csvPath = $dir . '/leads.csv';
$isNew = !is_file($csvPath);

/**
 * Different forms name the same thing differently — the calculators use
 * `business`, `first` and `last`; the application uses
 * `business_legal_name` and a single `owner_name`. Without this the CSV
 * has blank name and business columns for every application, which makes
 * the one file you actually open in Excel useless for half your traffic.
 */
$ownerName = trim((string) ($clean['owner_name'] ?? ''));
$nameParts = $ownerName === '' ? [] : preg_split('/\s+/', $ownerName);

$csvValue = static function (string $col) use ($clean, $nameParts): string {
    switch ($col) {
        case 'business':
            return (string) ($clean['business'] ?? $clean['business_legal_name'] ?? '');
        case 'first':
            return (string) ($clean['first'] ?? $clean['firstName'] ?? ($nameParts[0] ?? ''));
        case 'last':
            return (string) ($clean['last'] ?? $clean['lastName']
                ?? (count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : ''));
        case 'state':
            return (string) ($clean['state'] ?? $clean['business_state'] ?? '');
        default:
            return (string) ($clean[$col] ?? '');
    }
};

$extras = $clean;
$row = [];
foreach (CSV_COLUMNS as $col) {
    if ($col === 'received') {
        $row[] = date('Y-m-d H:i:s');
    } elseif ($col === 'kind') {
        $row[] = $kind;
    } elseif ($col === 'page') {
        $row[] = $record['page'];
    } else {
        $row[] = $csvValue($col);
        unset($extras[$col]);
    }
}
$row[] = $extras === [] ? '' : json_encode($extras, JSON_UNESCAPED_SLASHES);

$fh = @fopen($csvPath, 'a');
if ($fh !== false) {
    if (flock($fh, LOCK_EX)) {
        if ($isNew) {
            // BOM so Excel opens UTF-8 correctly on a double-click.
            fwrite($fh, "\xEF\xBB\xBF");
            fputcsv($fh, array_merge(CSV_COLUMNS, ['details']), ',', '"', '\\');
        }
        fputcsv($fh, $row, ',', '"', '\\');
        flock($fh, LOCK_UN);
    }
    fclose($fh);
    @chmod($csvPath, 0600);
}

respond(200, ['ok' => true, 'id' => $id, 'stored' => basename($file)]);
