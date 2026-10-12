<?php
declare(strict_types=1);

/**
 * Lead export endpoint — read-only feed for TMF OS to pull submissions
 * --------------------------------------------------------------------
 * Returns submissions stored in <application_dir>/leads newer than a given id
 * as JSON. Requires a valid export_key configured in api/config.php.
 *
 * Security invariants:
 *   - display_errors disabled (logs to error_log)
 *   - Rate limited per IP (RATE_PER_HOUR = 120)
 *   - Requires export_key; if empty or unset, endpoint is disabled (503)
 *   - Constant-time key comparison (hash_equals)
 *   - Strictly confined to <application_dir>/leads; never reads outside leads dir
 *   - Mark rows as fetched: records the latest fetched id in last_fetched.txt
 */

ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const RATE_PER_HOUR = 120;

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

// ---------------------------------------------------------------
// Config and export_key check
// ---------------------------------------------------------------
$cfg = is_readable(__DIR__ . '/config.php') ? (require __DIR__ . '/config.php') : [];
$exportKey = (string) ($cfg['export_key'] ?? '');

if ($exportKey === '') {
    respond(503, ['ok' => false, 'error' => 'Export endpoint is disabled. Set export_key in config.php.']);
}

// ---------------------------------------------------------------
// Rate limit per IP
// ---------------------------------------------------------------
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$rateFile = sys_get_temp_dir() . '/tmf_export_' . sha1($ip) . '.txt';
$hits = [];
if (is_readable($rateFile)) {
    $hits = array_filter(
        (array) json_decode((string) @file_get_contents($rateFile), true),
        static fn($t) => is_int($t) && $t > time() - 3600
    );
}
if (count($hits) >= RATE_PER_HOUR) {
    respond(429, ['ok' => false, 'error' => 'Too many requests from this connection.']);
}
$hits[] = time();
@file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);

// ---------------------------------------------------------------
// Key verification (constant-time)
// ---------------------------------------------------------------
$authHeader = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
$providedKey = '';
if (str_starts_with($authHeader, 'Bearer ')) {
    $providedKey = substr($authHeader, 7);
} elseif (!empty($_SERVER['HTTP_X_EXPORT_KEY'])) {
    // cPanel's Apache often drops Authorization, so TMF OS sends this too.
    $providedKey = (string) $_SERVER['HTTP_X_EXPORT_KEY'];
}
// Never from the query string: URLs land in the server's access log.

if ($providedKey === '' || !hash_equals($exportKey, $providedKey)) {
    respond(401, ['ok' => false, 'error' => 'Unauthorized.']);
}

// ---------------------------------------------------------------
// Leads directory validation (confined to leads dir)
// ---------------------------------------------------------------
$baseDir = rtrim((string) ($cfg['application_dir'] ?? (__DIR__ . '/uploads')), '/');
if ($baseDir === '' || $baseDir[0] !== '/') {
    $baseDir = __DIR__ . '/uploads';
}
$leadsDir = $baseDir . '/leads';

if (!is_dir($leadsDir)) {
    respond(200, ['ok' => true, 'count' => 0, 'submissions' => [], 'leads' => [], 'last_id' => null]);
}

$realLeadsDir = realpath($leadsDir);
if ($realLeadsDir === false) {
    respond(500, ['ok' => false, 'error' => 'Invalid leads directory.']);
}

$markerFile = $realLeadsDir . '/last_fetched.txt';

// Check if caller is marking an ID as fetched
$markId = trim((string) ($_POST['mark_fetched'] ?? $_GET['mark_fetched'] ?? ''));
if ($markId !== '' && $markId !== '1') {
    // Sanitise ID (alphanumeric/hyphen/underscore only)
    $cleanMarkId = preg_replace('/[^A-Za-z0-9_\-]/', '', $markId);
    @file_put_contents($markerFile, $cleanMarkId, LOCK_EX);
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && empty($_GET['after']) && empty($_GET['since'])) {
        respond(200, ['ok' => true, 'marked' => $cleanMarkId]);
    }
}

// Determine cursor / given ID
$afterId = trim((string) ($_GET['after'] ?? $_GET['since'] ?? $_GET['since_id'] ?? $_GET['after_id'] ?? ''));
if ($afterId === '' && is_readable($markerFile)) {
    $afterId = trim((string) file_get_contents($markerFile));
}

// ---------------------------------------------------------------
// Read all submission JSON files in chronological order
// ---------------------------------------------------------------
$monthDirs = glob($realLeadsDir . '/[0-9][0-9][0-9][0-9]-[0-9][0-9]', GLOB_ONLYDIR) ?: [];
sort($monthDirs);

$submissions = [];
foreach ($monthDirs as $mDir) {
    $realMDir = realpath($mDir);
    if ($realMDir === false || !str_starts_with($realMDir, $realLeadsDir . DIRECTORY_SEPARATOR)) {
        continue;
    }

    $files = glob($realMDir . '/*.json') ?: [];
    sort($files);

    foreach ($files as $f) {
        $realF = realpath($f);
        if ($realF === false || !str_starts_with($realF, $realLeadsDir . DIRECTORY_SEPARATOR)) {
            continue;
        }
        $filename = basename($realF);
        if ($filename === 'manifest.json') {
            continue;
        }

        $content = @file_get_contents($realF);
        if ($content === false) {
            continue;
        }
        $row = json_decode($content, true);
        if (!is_array($row) || empty($row['id'])) {
            continue;
        }

        // Flatten utm and ref fields for consumer
        $data = is_array($row['data'] ?? null) ? $row['data'] : [];
        $row['utm_source']   = $data['utm_source'] ?? $row['utm_source'] ?? null;
        $row['utm_medium']   = $data['utm_medium'] ?? $row['utm_medium'] ?? null;
        $row['utm_campaign'] = $data['utm_campaign'] ?? $data['campaign'] ?? $row['utm_campaign'] ?? null;
        $row['utm_content']  = $data['utm_content'] ?? $row['utm_content'] ?? null;
        $row['utm_term']     = $data['utm_term'] ?? $row['utm_term'] ?? null;
        $row['ref']          = $data['ref'] ?? $data['sl'] ?? $data['sl_id'] ?? $row['ref'] ?? null;

        $submissions[] = $row;
    }
}

// Filter to submissions newer than afterId
$result = [];
if ($afterId === '') {
    $result = $submissions;
} else {
    $found = false;
    foreach ($submissions as $sub) {
        if ($found) {
            $result[] = $sub;
        } elseif ((string) $sub['id'] === $afterId) {
            $found = true;
        }
    }
    // Fallback: if not found by exact ID, check if afterId is timestamp/date
    if (!$found) {
        $afterTime = strtotime($afterId);
        if ($afterTime !== false && $afterTime > 0) {
            foreach ($submissions as $sub) {
                $subTime = strtotime((string) ($sub['received'] ?? $sub['submittedAt'] ?? ''));
                if ($subTime !== false && $subTime > $afterTime) {
                    $result[] = $sub;
                }
            }
        } else {
            $result = $submissions;
        }
    }
}

// Mark last returned row if requested
if (($_GET['mark_fetched'] ?? $_GET['mark'] ?? '') === '1' && !empty($result)) {
    $lastRow = end($result);
    $lastId = (string) $lastRow['id'];
    @file_put_contents($markerFile, $lastId, LOCK_EX);
}

$lastReturnedId = !empty($result) ? (string) end($result)['id'] : ($afterId !== '' ? $afterId : null);

respond(200, [
    'ok'          => true,
    'count'       => count($result),
    'submissions' => $result,
    'leads'       => $result,
    'last_id'     => $lastReturnedId,
]);
