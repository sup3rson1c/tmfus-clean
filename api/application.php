<?php
declare(strict_types=1);

/**
 * Application intake — full application, encrypted at rest
 * ---------------------------------------------------------------
 * apply.html posts the complete application here. TMF collects all 29
 * fields itself; there is no handoff to a third-party signing platform.
 *
 * HOW THE SENSITIVE HALF IS PROTECTED
 * Social Security numbers, dates of birth and the signature image are
 * never written to disk in the clear and never appear in an email, a
 * URL or the leads spreadsheet. Each application is encrypted with a
 * fresh AES-256-GCM key, and that key is sealed with an RSA public key
 * held on this server. The matching PRIVATE key is not on this server
 * and must never be put on it — it lives on John's machine, inside
 * tmf-application-tool.html. Someone who steals this whole account gets
 * ciphertext and no way to read it.
 *
 * FAIL CLOSED
 * If no usable public key is configured, the endpoint refuses the
 * submission rather than storing an SSN in the clear or pretending it
 * saved something it did not.
 *
 * Endpoint:  POST /api/application.php   (multipart/form-data)
 *   application    JSON, the full application including sensitive fields
 *   statements[]   0..12 files, PDF / JPG / PNG, <= 10 MB each
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const MAX_FILES     = 12;
const MAX_BYTES     = 10485760;   // 10 MB
const MAX_TOTAL     = 62914560;   // 60 MB per submission
const MAX_JSON      = 2097152;    // 2 MB — the signature PNG dominates this
const RATE_PER_HOUR = 12;

/**
 * Keys that must never reach the notification email, the leads sheet, or
 * any plaintext file. They are still stored — inside the encrypted
 * envelope only.
 */
const SENSITIVE_KEYS = ['ssn', 'dob', 'signature', 'sig', 'birth', 'social'];

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

/** True when the key name looks like something we must not store in the clear. */
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

/**
 * Seal a payload so only the holder of the private key can read it.
 *
 * Hybrid, because RSA cannot encrypt a payload this size directly:
 *   - a fresh 256-bit key encrypts the JSON with AES-256-GCM
 *   - RSA-OAEP seals that key
 * OAEP here uses SHA-1 for the label hash, because that is what PHP's
 * OPENSSL_PKCS1_OAEP_PADDING emits and what the browser tool is set to
 * expect. OAEP does not depend on that hash being collision-resistant,
 * so this is a compatibility choice rather than a weakness. Change it on
 * one side and nothing will decrypt on the other.
 */
function sealEnvelope(string $plaintext, string $publicKeyPem): ?array
{
    $key = openssl_pkey_get_public($publicKeyPem);
    if ($key === false) {
        return null;
    }

    $aesKey = random_bytes(32);
    $iv     = random_bytes(12);
    $tag    = '';

    $ciphertext = openssl_encrypt(
        $plaintext,
        'aes-256-gcm',
        $aesKey,
        OPENSSL_RAW_DATA,
        $iv,
        $tag,
        '',
        16
    );
    if ($ciphertext === false || $tag === '') {
        return null;
    }

    $sealedKey = '';
    if (!openssl_public_encrypt($aesKey, $sealedKey, $key, OPENSSL_PKCS1_OAEP_PADDING)) {
        return null;
    }

    if (function_exists('sodium_memzero')) {
        sodium_memzero($aesKey);
    }

    return [
        'v'          => 1,
        'alg'        => 'RSA-OAEP-SHA1 + AES-256-GCM',
        'created'    => date('c'),
        'sealed_key' => base64_encode($sealedKey),
        'iv'         => base64_encode($iv),
        'tag'        => base64_encode($tag),
        'data'       => base64_encode($ciphertext),
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'POST only.');
}

// ---------------------------------------------------------------
// Config. Unlike the previous version this endpoint is not optional-
// config: without a public key it cannot protect what it is being sent.
// ---------------------------------------------------------------
$cfg = is_readable(__DIR__ . '/config.php') ? (require __DIR__ . '/config.php') : [];
$storeDir = $cfg['application_dir']    ?? (__DIR__ . '/uploads');
$notifyTo = $cfg['application_notify'] ?? '';

$publicKeyPem = (string) ($cfg['application_pubkey'] ?? '');
if ($publicKeyPem !== '' && !str_contains($publicKeyPem, 'BEGIN PUBLIC KEY')) {
    // Not an inline key, so treat it as a path to a .pem file.
    $publicKeyPem = is_readable($publicKeyPem)
        ? (string) file_get_contents($publicKeyPem)
        : '';
}
if ($publicKeyPem === '' || openssl_pkey_get_public($publicKeyPem) === false) {
    error_log('application.php: no usable application_pubkey in config.php — refusing submission');
    fail(503, 'Applications cannot be accepted right now. Please call us and an advisor will take this over the phone.');
}

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
// The application itself.
// ---------------------------------------------------------------
$raw = (string) ($_POST['application'] ?? '');
if ($raw === '' || strlen($raw) > MAX_JSON) {
    fail(400, 'The application did not arrive intact. Please try again.');
}

$app = json_decode($raw, true);
if (!is_array($app) || $app === []) {
    fail(400, 'The application did not arrive intact. Please try again.');
}

/**
 * $full  — everything, goes only into the sealed envelope.
 * $clean — the non-sensitive subset, safe for the notification email.
 */
$full  = [];
$clean = [];
foreach ($app as $k => $v) {
    if (!is_string($k) || is_array($v)) {
        continue;
    }
    $key = substr((string) preg_replace('/[^a-z0-9_]/i', '', $k), 0, 40);
    if ($key === '') {
        continue;
    }
    // The signature is a data URL and legitimately long; everything else is a field.
    $full[$key] = substr((string) $v, 0, isSensitiveKey($key) ? 1500000 : 500);
    if (!isSensitiveKey($key)) {
        $clean[$key] = substr((string) $v, 0, 200);
    }
}

if (($full['business_legal_name'] ?? '') === '' || ($full['owner_name'] ?? '') === '') {
    fail(400, 'The application is missing the business or owner name.');
}

$business = $clean['business_legal_name'] ?? 'Unknown business';
$slug = strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $business));
$slug = trim(substr($slug, 0, 40), '-') ?: 'applicant';

$reference = strtoupper(bin2hex(random_bytes(3)));

// ---------------------------------------------------------------
// Storage directory. Created for every application now, not only when
// statements are attached — the sealed envelope always needs a home.
// ---------------------------------------------------------------
$stamp = date('Y-m-d_His');
$dir = rtrim($storeDir, '/') . '/' . $stamp . '_' . $slug . '_' . $reference;

if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
    error_log('application.php: could not create ' . $dir);
    fail(500, 'We could not save your application. Please call us rather than resending.');
}

// Belt and braces: not browsable even if it lands inside the web root on
// a host that ignores the parent rules.
@file_put_contents(dirname($dir) . '/.htaccess', "Require all denied\nOptions -Indexes\n");
@file_put_contents(dirname($dir) . '/index.html', '');

// ---------------------------------------------------------------
// Seal and write. This happens BEFORE the files are handled, so a
// problem with an upload can never cost us the application itself.
// ---------------------------------------------------------------
$record = [
    'reference'   => $reference,
    'received'    => date('c'),
    'application' => $full,
    'audit'       => [
        'ip'              => $ip,
        'user_agent'      => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
        'consent_credit'  => (string) ($full['consent_credit'] ?? ''),
        'consent_contact' => (string) ($full['consent_contact'] ?? ''),
        'consent_text_id' => (string) ($full['consent_text_id'] ?? ''),
        'signed_at'       => (string) ($full['signed_at'] ?? ''),
    ],
];

$envelope = sealEnvelope(
    (string) json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    $publicKeyPem
);
if ($envelope === null) {
    error_log('application.php: sealEnvelope failed');
    fail(500, 'We could not save your application securely. Please call us rather than resending.');
}

$envPath = $dir . '/application.enc.json';
if (@file_put_contents($envPath, json_encode($envelope, JSON_PRETTY_PRINT), LOCK_EX) === false) {
    error_log('application.php: could not write ' . $envPath);
    fail(500, 'We could not save your application. Please call us rather than resending.');
}
@chmod($envPath, 0600);

// Plaintext companion, sensitive fields excluded. This exists so an
// advisor can see who applied without decrypting anything.
@file_put_contents(
    $dir . '/summary.json',
    json_encode(
        ['reference' => $reference, 'received' => date('c'), 'ip' => $ip, 'application' => $clean],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
    ),
    LOCK_EX
);
@chmod($dir . '/summary.json', 0600);

// ---------------------------------------------------------------
// Files. Type is decided by finfo on the actual bytes, never by the
// name or the browser-supplied content type.
// ---------------------------------------------------------------
$saved = [];
$rejected = [];

if (!empty($_FILES['statements']['name'][0])) {
    $names = (array) $_FILES['statements']['name'];

    if (count($names) > MAX_FILES) {
        $rejected[] = 'more than ' . MAX_FILES . ' files were sent';
        $names = array_slice($names, 0, MAX_FILES, true);
    }

    $total = array_sum(array_map('intval', (array) $_FILES['statements']['size']));
    if ($total > MAX_TOTAL) {
        $rejected[] = 'the files totalled more than 60 MB';
        $names = [];
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);

    foreach ($names as $i => $original) {
        $err   = (int) $_FILES['statements']['error'][$i];
        $tmp   = (string) $_FILES['statements']['tmp_name'][$i];
        $size  = (int) $_FILES['statements']['size'][$i];
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

        $safe = (string) preg_replace('/[^A-Za-z0-9._-]/', '_', pathinfo($shown, PATHINFO_FILENAME));
        $safe = substr(trim($safe, '._-'), 0, 60) ?: 'statement';
        $dest = $dir . '/' . sprintf('%02d', (int) $i + 1) . '_' . $safe . '.' . ALLOWED_MIME[$mime];

        if (@move_uploaded_file($tmp, $dest)) {
            @chmod($dest, 0600);
            $saved[] = basename($dest);
        } else {
            $rejected[] = $shown . ' (could not be saved)';
        }
    }
}

// ---------------------------------------------------------------
// Notify. No personal data in the body beyond the business name — an
// email is not a place to put an applicant's details, and this one
// travels unencrypted the moment it leaves the server.
// ---------------------------------------------------------------
if ($notifyTo !== '' && filter_var($notifyTo, FILTER_VALIDATE_EMAIL)) {
    $lines = [
        'New application received on tmfus.com',
        str_repeat('-', 42),
        '',
        'Reference:   ' . $reference,
        'Business:    ' . $business,
        'Received:    ' . date('D j M Y, H:i T'),
        'Statements:  ' . (count($saved) ?: 'none attached'),
        '',
        'The full application is encrypted on the server at:',
        '  ' . $dir . '/application.enc.json',
        '',
        'To read it: download that file in cPanel File Manager and open it in',
        'tmf-application-tool.html on your own machine. Nothing in this email',
        'contains the applicant\'s personal details, on purpose.',
    ];
    if ($rejected !== []) {
        $lines[] = '';
        $lines[] = 'Files not accepted: ' . implode(', ', $rejected);
    }

    @mail(
        $notifyTo,
        'Application ' . $reference . ' — ' . $business,
        implode("\n", $lines),
        "From: no-reply@tmfus.com\r\nContent-Type: text/plain; charset=utf-8\r\n"
    );
}

respond(200, [
    'ok'        => true,
    'reference' => $reference,
    'stored'    => count($saved),
    'rejected'  => $rejected,
]);
