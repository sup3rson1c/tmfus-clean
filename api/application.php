<?php
declare(strict_types=1);

/**
 * Application intake — bank statements and applicant summary
 * ---------------------------------------------------------------
 * The branded form on apply.html posts here when the applicant attached
 * bank statements. It stores the files under a directory the web server
 * refuses to serve, and emails TMF that a file is waiting.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * It does not accept, store or log Social Security numbers, dates of
 * birth or signatures. Those are entered on the signing platform, which
 * is what makes the signature legally recorded. If a payload arrives
 * carrying them anyway they are dropped before anything is written.
 *
 * Endpoint:  POST /api/application.php   (multipart/form-data)
 *   meta           JSON summary of the application
 *   statements[]   0..12 files, PDF / JPG / PNG, <= 10 MB each
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const MAX_FILES     = 12;
const MAX_BYTES     = 10485760;   // 10 MB
const MAX_TOTAL     = 62914560;   // 60 MB per submission
const RATE_PER_HOUR = 12;

/** Keys that must never be written to disk, whatever the browser sent. */
const FORBIDDEN_KEYS = ['ssn', 'dob', 'signature', 'sig', 'birth', 'social'];

const ALLOWED_MIME = [
    'application/pdf' => 'pdf',
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
];

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

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'POST only.');
}

// ---------------------------------------------------------------
// Config is optional here — the endpoint works without it.
// ---------------------------------------------------------------
$cfg = is_readable(__DIR__ . '/config.php') ? (require __DIR__ . '/config.php') : [];
$storeDir  = $cfg['application_dir']   ?? (__DIR__ . '/uploads');
$notifyTo  = $cfg['application_notify'] ?? '';

// ---------------------------------------------------------------
// Rate limit. A public upload endpoint is a free disk-filling service
// otherwise.
// ---------------------------------------------------------------
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$rateFile = sys_get_temp_dir() . '/tmf_apply_' . sha1($ip) . '.txt';
$hits = [];
if (is_readable($rateFile)) {
    $hits = array_filter(
        (array) json_decode((string) @file_get_contents($rateFile), true),
        static fn($t) => is_int($t) && $t > time() - 3600
    );
}
if (count($hits) >= RATE_PER_HOUR) {
    fail(429, 'Too many submissions from this connection. Please try again later.');
}
$hits[] = time();
@file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);

// ---------------------------------------------------------------
// Summary. Scrubbed, then truncated — this is a notification, not a
// system of record.
// ---------------------------------------------------------------
$meta = json_decode((string) ($_POST['meta'] ?? '{}'), true);
if (!is_array($meta)) {
    $meta = [];
}
$clean = [];
foreach ($meta as $k => $v) {
    if (!is_string($k) || is_array($v)) {
        continue;
    }
    $lower = strtolower($k);
    foreach (FORBIDDEN_KEYS as $bad) {
        if (str_contains($lower, $bad)) {
            continue 2;
        }
    }
    $clean[substr(preg_replace('/[^a-z0-9_]/i', '', $k), 0, 40)] = substr((string) $v, 0, 200);
}

$business = $clean['business_legal_name'] ?? 'Unknown business';
$slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $business));
$slug = trim(substr($slug, 0, 40), '-') ?: 'applicant';

// ---------------------------------------------------------------
// Files. Type is decided by finfo on the actual bytes, never by the
// name or the browser-supplied content type.
// ---------------------------------------------------------------
$saved = [];
$rejected = [];
$dir = null;

if (!empty($_FILES['statements']['name'][0])) {
    $names = (array) $_FILES['statements']['name'];
    if (count($names) > MAX_FILES) {
        fail(400, 'Too many files. Send up to ' . MAX_FILES . '.');
    }

    $total = array_sum(array_map('intval', (array) $_FILES['statements']['size']));
    if ($total > MAX_TOTAL) {
        fail(413, 'Those files total more than 60 MB. Send fewer at a time.');
    }

    $stamp = date('Y-m-d_His');
    $dir = rtrim($storeDir, '/') . '/' . $stamp . '_' . $slug . '_' . bin2hex(random_bytes(4));

    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        fail(500, 'Could not store the files. An advisor will email you a secure upload link.');
    }

    // Belt and braces: the folder must not be browsable even if it ends up
    // inside the web root on a host that ignores the parent rules.
    @file_put_contents(dirname($dir) . '/.htaccess', "Require all denied\nOptions -Indexes\n");
    @file_put_contents(dirname($dir) . '/index.html', '');

    $finfo = new finfo(FILEINFO_MIME_TYPE);

    foreach ($names as $i => $original) {
        $err = (int) $_FILES['statements']['error'][$i];
        $tmp = (string) $_FILES['statements']['tmp_name'][$i];
        $size = (int) $_FILES['statements']['size'][$i];
        $shown = substr(basename((string) $original), 0, 80);

        if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
            $rejected[] = $shown . ' (upload failed)';
            continue;
        }
        if ($size > MAX_BYTES) {
            $rejected[] = $shown . ' (over 10 MB)';
            continue;
        }

        $mime = (string) $finfo->file($tmp);
        if (!isset(ALLOWED_MIME[$mime])) {
            $rejected[] = $shown . ' (not a PDF or image)';
            continue;
        }

        $safe = preg_replace('/[^A-Za-z0-9._-]/', '_', pathinfo($shown, PATHINFO_FILENAME));
        $safe = substr(trim($safe, '._-'), 0, 60) ?: 'statement';
        $dest = $dir . '/' . sprintf('%02d', $i + 1) . '_' . $safe . '.' . ALLOWED_MIME[$mime];

        if (@move_uploaded_file($tmp, $dest)) {
            @chmod($dest, 0600);
            $saved[] = basename($dest);
        } else {
            $rejected[] = $shown . ' (could not be saved)';
        }
    }

    if ($saved !== []) {
        @file_put_contents(
            $dir . '/summary.json',
            json_encode(
                ['received' => date('c'), 'ip' => $ip, 'application' => $clean],
                JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
            )
        );
        @chmod($dir . '/summary.json', 0600);
    }
}

// ---------------------------------------------------------------
// Notify. Best effort — a mail failure must not fail the application.
// ---------------------------------------------------------------
if ($notifyTo !== '' && filter_var($notifyTo, FILTER_VALIDATE_EMAIL)) {
    $lines = ['New application from tmfus.com', str_repeat('-', 40), ''];
    foreach ($clean as $k => $v) {
        $lines[] = str_pad(str_replace('_', ' ', $k) . ':', 26) . $v;
    }
    $lines[] = '';
    $lines[] = 'Statements saved: ' . (count($saved) ?: 'none');
    foreach ($saved as $f) {
        $lines[] = '  - ' . $f;
    }
    if ($rejected !== []) {
        $lines[] = 'Rejected: ' . implode(', ', $rejected);
    }
    if ($dir !== null) {
        $lines[] = 'Folder: ' . $dir;
    }

    @mail(
        $notifyTo,
        'Application — ' . $business,
        implode("\n", $lines),
        "From: no-reply@tmfus.com\r\nContent-Type: text/plain; charset=utf-8\r\n"
    );
}

respond(200, [
    'ok'       => true,
    'stored'   => count($saved),
    'rejected' => $rejected,
]);
