<?php
declare(strict_types=1);

/**
 * TMF Team — application inbox
 * ---------------------------------------------------------------
 * A password-protected page for reading applications and leads without
 * going anywhere near cPanel.
 *
 * THE ONE THING THAT MAKES THIS SAFE
 * This script never decrypts anything, and it could not if it wanted to
 * — the private key is not on this server. It hands the browser the
 * sealed envelope exactly as it sits on disk; John's browser unlocks it
 * with the key file on his own machine. So a stolen password, a stolen
 * session, or a stolen server still yields no Social Security numbers.
 *
 * WHAT A STOLEN PASSWORD *DOES* YIELD
 * Names, businesses, emails, phone numbers, and the bank statements.
 * Those are not encrypted. Use a long password, and change it if you
 * ever suspect it has leaked. That trade is the price of not using
 * cPanel, and it was made knowingly.
 *
 * SETUP — add to api/config.php:
 *     'admin_password' => 'a long random passphrase',
 * or, if you would rather not keep it in plain text:
 *     'admin_password_hash' => '<output of PHP password_hash()>',
 * Without one of those this page refuses to run at all.
 */

const SESSION_NAME     = 'tmfadmin';
const SESSION_IDLE     = 3600;   // seconds before an idle session is dropped
const LOGIN_PER_HOUR   = 10;     // attempts per IP
const FOLDER_PATTERN   = '/^\d{4}-\d{2}-\d{2}_\d{6}_[a-z0-9-]+_[A-F0-9]{6}$/';
const STATEMENT_PATTERN = '/^\d{2}_[A-Za-z0-9._-]+\.(pdf|jpg|png)$/';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, private');

$cfg = is_readable(__DIR__ . '/api/config.php') ? (require __DIR__ . '/api/config.php') : [];
$storeDir = rtrim((string) ($cfg['application_dir'] ?? ''), '/');
$passPlain = (string) ($cfg['admin_password'] ?? '');
$passHash  = (string) ($cfg['admin_password_hash'] ?? '');

/* ---------------------------------------------------------------
   Refuse to run in states where running would be worse than not.
   --------------------------------------------------------------- */
function bail(string $title, string $detail): void
{
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><meta charset="utf-8"><title>' . htmlspecialchars($title) . '</title>'
       . '<body style="font:16px/1.6 system-ui,sans-serif;background:#0a0a0b;color:#fafafa;padding:60px 24px">'
       . '<div style="max-width:640px;margin:0 auto">'
       . '<h1 style="font-size:1.4rem">' . htmlspecialchars($title) . '</h1>'
       . '<p style="color:#a1a1aa">' . $detail . '</p></div>';
    exit;
}

$https = (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off')
      || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$localhost = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);

if (!$https && !$localhost) {
    bail('This page needs HTTPS', 'A password typed over an unencrypted connection can be read in transit. '
        . 'Open this page as <code>https://</code> instead.');
}
if ($passPlain === '' && $passHash === '') {
    bail('No password set', 'Add <code>\'admin_password\' =&gt; \'a long random passphrase\',</code> to '
        . '<code>api/config.php</code>, then reload. Until then this page will not open — '
        . 'an inbox of customer applications with no password is worse than no inbox.');
}
if ($storeDir === '' || $storeDir[0] !== '/') {
    bail('Storage is not configured', 'Set <code>application_dir</code> in <code>api/config.php</code> to an '
        . 'absolute path such as <code>/home/yourusername/tmf-applications</code>.');
}

/* ---------------------------------------------------------------
   Session
   --------------------------------------------------------------- */
session_name(SESSION_NAME);
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $https,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

$action = (string) ($_GET['action'] ?? $_POST['action'] ?? '');

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    header('Location: admin.php');
    exit;
}

/* Idle timeout. */
if (!empty($_SESSION['ok']) && (time() - (int) ($_SESSION['seen'] ?? 0)) > SESSION_IDLE) {
    $_SESSION = [];
    session_destroy();
    session_start();
}

$loginError = '';

if ($action === 'login') {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    $rateFile = sys_get_temp_dir() . '/tmf_admin_' . sha1($ip) . '.txt';
    $hits = [];
    if (is_readable($rateFile)) {
        $hits = array_filter(
            (array) json_decode((string) @file_get_contents($rateFile), true),
            static fn($t) => is_int($t) && $t > time() - 3600
        );
    }

    if (count($hits) >= LOGIN_PER_HOUR) {
        $loginError = 'Too many attempts from this connection. Try again in an hour.';
    } else {
        $hits[] = time();
        @file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);

        $given = (string) ($_POST['password'] ?? '');
        $good = $passHash !== ''
            ? password_verify($given, $passHash)
            : hash_equals($passPlain, $given);

        // Cheap brute-force tax; also hides timing differences.
        usleep(400000);

        if ($good) {
            session_regenerate_id(true);
            $_SESSION['ok'] = true;
            $_SESSION['seen'] = time();
            header('Location: admin.php');
            exit;
        }
        $loginError = 'That password is not right.';
    }
}

$authed = !empty($_SESSION['ok']);
if ($authed) {
    $_SESSION['seen'] = time();
}

/* ---------------------------------------------------------------
   Data helpers. Every path is rebuilt from a directory listing and a
   strict name pattern — nothing the browser sends is ever used to
   build a path, so there is no traversal to find.
   --------------------------------------------------------------- */
function applicationFolders(string $storeDir): array
{
    $out = [];
    foreach ((array) @scandir($storeDir) as $name) {
        if (!is_string($name) || !preg_match(FOLDER_PATTERN, $name)) {
            continue;
        }
        $path = $storeDir . '/' . $name;
        if (!is_dir($path)) {
            continue;
        }

        $summary = [];
        if (is_readable($path . '/summary.json')) {
            $summary = (array) json_decode((string) @file_get_contents($path . '/summary.json'), true);
        }
        $app = (array) ($summary['application'] ?? []);

        $statements = [];
        foreach ((array) @scandir($path) as $f) {
            if (is_string($f) && preg_match(STATEMENT_PATTERN, $f)) {
                $statements[] = $f;
            }
        }

        $out[] = [
            'folder'     => $name,
            'reference'  => (string) ($summary['reference'] ?? substr($name, -6)),
            'received'   => (string) ($summary['received'] ?? ''),
            'business'   => (string) ($app['business_legal_name'] ?? ''),
            'owner'      => (string) ($app['owner_name'] ?? ''),
            'email'      => (string) ($app['email'] ?? ''),
            'phone'      => (string) ($app['phone'] ?? ''),
            'state'      => (string) ($app['business_state'] ?? ''),
            'amount'     => (string) ($app['amount_requested'] ?? ''),
            'statements' => $statements,
            'sealed'     => is_readable($path . '/application.enc.json'),
        ];
    }

    usort($out, static fn($a, $b) => strcmp($b['folder'], $a['folder']));
    return $out;
}

function leadRecords(string $storeDir, int $limit = 400): array
{
    $base = $storeDir . '/leads';
    $out = [];
    foreach (array_reverse((array) @scandir($base)) as $month) {
        if (!is_string($month) || !preg_match('/^\d{4}-\d{2}$/', $month)) {
            continue;
        }
        $dir = $base . '/' . $month;
        $files = array_reverse((array) @scandir($dir));
        foreach ($files as $f) {
            if (!is_string($f) || !preg_match('/^\d{2}_\d{6}_[a-z0-9-]+_[A-F0-9]{6}\.json$/', $f)) {
                continue;
            }
            $rec = (array) json_decode((string) @file_get_contents($dir . '/' . $f), true);
            if ($rec === []) {
                continue;
            }
            $d = (array) ($rec['data'] ?? []);
            $name = trim(($d['first'] ?? $d['firstName'] ?? '') . ' ' . ($d['last'] ?? $d['lastName'] ?? ''));
            if ($name === '') {
                $name = (string) ($d['owner_name'] ?? '');
            }
            $out[] = [
                'month'    => $month,
                'id'       => (string) ($rec['id'] ?? ''),
                'kind'     => (string) ($rec['kind'] ?? ''),
                'received' => (string) ($rec['received'] ?? ''),
                'name'     => $name,
                'business' => (string) ($d['business'] ?? $d['business_legal_name'] ?? ''),
                'email'    => (string) ($d['email'] ?? ''),
                'phone'    => (string) ($d['phone'] ?? ''),
                'data'     => $d,
            ];
            if (count($out) >= $limit) {
                return $out;
            }
        }
    }
    return $out;
}

/* ---------------------------------------------------------------
   Live chat. Transcripts are written by api/chat.php; this side reads
   them and can write operator turns into them.
   --------------------------------------------------------------- */
function chatPath(string $storeDir, string $session): ?string
{
    if (!preg_match('/^[a-f0-9]{32}$/', $session)) {
        return null;
    }
    $p = $storeDir . '/chats/' . substr($session, 0, 2) . '/' . $session . '.json';
    return is_file($p) ? $p : null;
}

function loadChat(string $storeDir, string $session): ?array
{
    $p = chatPath($storeDir, $session);
    if ($p === null) {
        return null;
    }
    $t = json_decode((string) @file_get_contents($p), true);
    return is_array($t) ? $t : null;
}

function saveChat(string $storeDir, array $t): bool
{
    $p = chatPath($storeDir, (string) ($t['session'] ?? ''));
    if ($p === null) {
        return false;
    }
    $t['updated'] = date('c');
    $ok = @file_put_contents($p, json_encode($t, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX) !== false;
    @chmod($p, 0600);
    return $ok;
}

function chatList(string $storeDir, int $limit = 80): array
{
    $base = $storeDir . '/chats';
    $out = [];
    foreach ((array) @scandir($base) as $bucket) {
        if (!is_string($bucket) || !preg_match('/^[a-f0-9]{2}$/', $bucket)) {
            continue;
        }
        foreach ((array) @scandir($base . '/' . $bucket) as $f) {
            if (!is_string($f) || !preg_match('/^[a-f0-9]{32}\.json$/', $f)) {
                continue;
            }
            $t = json_decode((string) @file_get_contents($base . '/' . $bucket . '/' . $f), true);
            if (!is_array($t)) {
                continue;
            }
            $msgs = (array) ($t['messages'] ?? []);
            $last = '';
            for ($i = count($msgs) - 1; $i >= 0; $i--) {
                if (($msgs[$i]['role'] ?? '') !== 'system') {
                    $last = (string) $msgs[$i]['text'];
                    break;
                }
            }
            $v = (array) ($t['visitor'] ?? []);
            $out[] = [
                'session' => (string) ($t['session'] ?? ''),
                'created' => (string) ($t['created'] ?? ''),
                'updated' => (string) ($t['updated'] ?? ''),
                'page'    => (string) ($t['page'] ?? ''),
                'human'   => !empty($t['human']),
                'waiting' => !empty($t['waiting']),
                'name'    => (string) ($v['name'] ?? ''),
                'phone'   => (string) ($v['phone'] ?? ''),
                'turns'   => count($msgs),
                'last'    => mb_substr($last, 0, 90),
            ];
        }
    }

    // Anyone waiting for a person goes to the top, then most recent.
    usort($out, static function ($a, $b) {
        if ($a['waiting'] !== $b['waiting']) {
            return $a['waiting'] ? -1 : 1;
        }
        return strcmp($b['updated'], $a['updated']);
    });

    return array_slice($out, 0, $limit);
}

/** Resolve a browser-supplied folder name to a real folder, or null. */
function safeFolder(string $storeDir, string $wanted): ?string
{
    if (!preg_match(FOLDER_PATTERN, $wanted)) {
        return null;
    }
    $path = $storeDir . '/' . $wanted;
    return is_dir($path) ? $path : null;
}

/* ---------------------------------------------------------------
   Authenticated endpoints
   --------------------------------------------------------------- */
if ($authed && $action !== '') {
    if ($action === 'applications') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(applicationFolders($storeDir));
        exit;
    }

    if ($action === 'leads') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(leadRecords($storeDir));
        exit;
    }

    /* ---- live chat ---- */
    if ($action === 'chats') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(chatList($storeDir));
        exit;
    }

    if ($action === 'chat') {
        $t = loadChat($storeDir, (string) ($_GET['session'] ?? ''));
        if ($t === null) { http_response_code(404); exit; }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($t);
        exit;
    }

    if ($action === 'chattake' || $action === 'chatrelease' || $action === 'chatsend') {
        $session = (string) ($_POST['session'] ?? $_GET['session'] ?? '');
        $t = loadChat($storeDir, $session);
        if ($t === null) { http_response_code(404); exit; }

        if ($action === 'chattake') {
            $t['human'] = true;
            $t['waiting'] = false;
        } elseif ($action === 'chatrelease') {
            $t['human'] = false;
            $t['messages'][] = [
                'role' => 'system',
                'text' => 'The advisor stepped away. The assistant is answering again.',
                'at'   => date('c'),
            ];
        } else {
            $text = trim((string) ($_POST['text'] ?? ''));
            if ($text === '') { http_response_code(400); exit; }
            // The operator is a trusted human, but the transcript is shared
            // with a language model later — keep the same rule for everyone.
            $t['human'] = true;
            $t['waiting'] = false;
            $t['messages'][] = [
                'role' => 'operator',
                'text' => mb_substr($text, 0, 2000),
                'at'   => date('c'),
            ];
        }

        saveChat($storeDir, $t);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => true, 'total' => count($t['messages'])]);
        exit;
    }

    if ($action === 'envelope') {
        $dir = safeFolder($storeDir, (string) ($_GET['folder'] ?? ''));
        if ($dir === null || !is_readable($dir . '/application.enc.json')) {
            http_response_code(404);
            exit;
        }
        header('Content-Type: application/json; charset=utf-8');
        readfile($dir . '/application.enc.json');
        exit;
    }

    if ($action === 'statement') {
        $dir = safeFolder($storeDir, (string) ($_GET['folder'] ?? ''));
        $name = (string) ($_GET['name'] ?? '');
        if ($dir === null || !preg_match(STATEMENT_PATTERN, $name) || !is_readable($dir . '/' . $name)) {
            http_response_code(404);
            exit;
        }
        $mime = ['pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'png' => 'image/png'];
        $ext = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
        header('Content-Type: ' . ($mime[$ext] ?? 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . $name . '"');
        header('Content-Length: ' . (string) filesize($dir . '/' . $name));
        readfile($dir . '/' . $name);
        exit;
    }

    if ($action === 'csv') {
        $month = (string) ($_GET['month'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            http_response_code(400);
            exit;
        }
        $path = $storeDir . '/leads/' . $month . '/leads.csv';
        if (!is_readable($path)) {
            http_response_code(404);
            exit;
        }
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="leads-' . $month . '.csv"');
        readfile($path);
        exit;
    }
}

if (!$authed && $action !== '' && $action !== 'login') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'not signed in']);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Application inbox | TMF Team</title>
<style>
  :root{
    --bg:#0a0a0b; --panel:#131316; --panel-2:#1a1a1f; --line:#2a2a31;
    --fg:#fafafa; --muted:#a1a1aa; --accent:#34d399; --accent-2:#4aa5e8;
    --danger:#f87171; --radius:.75rem;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);
    font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:1080px;margin:0 auto;padding:34px 20px 90px}
  h1{font-size:1.45rem;margin:0;letter-spacing:-.02em}
  h1 b{background:linear-gradient(90deg,var(--accent),var(--accent-2));
    -webkit-background-clip:text;background-clip:text;color:transparent}
  .top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:6px}
  .muted{color:var(--muted)}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:22px;margin-top:20px}
  button,.btn{font:inherit;font-weight:600;cursor:pointer;border-radius:var(--radius);
    padding:10px 18px;border:1px solid transparent;text-decoration:none;display:inline-block}
  .primary{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#04120e}
  .ghost{background:transparent;border-color:var(--line);color:var(--fg)}
  .ghost:hover{border-color:var(--accent)}
  input[type=password],input[type=search]{font:inherit;width:100%;background:#08080a;color:var(--fg);
    border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px}
  label.file{display:inline-flex;align-items:center;gap:9px;background:var(--panel-2);
    border:1px dashed var(--line);border-radius:var(--radius);padding:10px 16px;cursor:pointer;font-size:.93rem}
  label.file:hover{border-color:var(--accent)}
  label.file input{display:none}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{text-align:left;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
    color:var(--muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--line)}
  td{padding:11px 10px;border-bottom:1px solid var(--line);font-size:.93rem;vertical-align:top}
  tr.row{cursor:pointer}
  tr.row:hover td{background:var(--panel-2)}
  .ref{font-family:ui-monospace,Menlo,monospace;font-size:.82rem;color:var(--accent)}
  .tabs{display:flex;gap:8px;margin-top:22px;flex-wrap:wrap}
  .tab{padding:9px 17px;border-radius:999px;border:1px solid var(--line);cursor:pointer;font-size:.92rem}
  .tab.on{background:var(--panel-2);border-color:var(--accent);color:var(--fg)}
  .bad{color:var(--danger);white-space:pre-wrap}
  .ok{color:var(--accent)}
  .hide{display:none!important}
  .keystate{display:inline-block;padding:6px 13px;border-radius:999px;font-size:.82rem;
    border:1px solid var(--line);color:var(--muted);margin-right:8px}
  .keystate.on{border-color:var(--accent);color:var(--accent)}
  /* Sensitive values are covered until asked for. Somebody standing behind
     John, or a screen he shares, should not read an SSN by accident. */
  .veil{border:none;background:var(--panel-2);color:var(--muted);font:inherit;font-size:.85rem;
    border-radius:6px;padding:3px 10px;cursor:pointer}
  .veil:hover{color:var(--fg)}
  .mono-label{font-family:ui-monospace,Menlo,monospace;font-size:.7rem;letter-spacing:.14em;
    text-transform:uppercase;color:var(--muted)}
  .warn{border-left:3px solid var(--accent);background:rgba(52,211,153,.07);
    padding:12px 15px;border-radius:0 var(--radius) var(--radius) 0;font-size:.9rem;margin-top:14px}
  .sig{background:#fff;border-radius:8px;padding:8px;max-width:400px;margin-top:8px}
  .sig img{display:block;width:100%}
  .group{margin-top:24px}
  .group h3{font-size:.95rem;margin:0 0 4px}
  td.k{color:var(--muted);width:230px}
  dialog{border:none;background:transparent;padding:0;max-width:920px;width:94%;color:var(--fg)}
  dialog::backdrop{background:rgba(0,0,0,.72)}
  /* The dialog sits over a dimmed page, so it needs to be visibly lighter
     than the panels behind it or the whole thing reads as greyed-out. */
  dialog .card{background:#17171c;border-color:#33333c}
  dialog td{color:var(--fg)}
  dialog td.k{color:var(--muted)}
  @media print{ body{background:#fff;color:#000} .noprint{display:none!important} .card{border:none;background:#fff} }
</style>
</head>
<body>
<div class="wrap">

<?php if (!$authed): ?>

  <h1>Application <b>inbox</b></h1>
  <p class="muted" style="margin-top:6px">TMF Team</p>

  <div class="card" style="max-width:440px">
    <form method="post">
      <input type="hidden" name="action" value="login">
      <label class="mono-label" for="pw">Password</label>
      <div style="margin-top:8px"><input type="password" id="pw" name="password" autocomplete="current-password" autofocus></div>
      <?php if ($loginError !== ''): ?>
        <p class="bad" style="font-size:.92rem"><?= htmlspecialchars($loginError) ?></p>
      <?php endif; ?>
      <button class="primary" style="width:100%;margin-top:14px" type="submit">Sign in</button>
    </form>
  </div>

<?php else: ?>

  <div class="top">
    <div>
      <h1>Application <b>inbox</b></h1>
      <p class="muted" style="margin:2px 0 0;font-size:.92rem">TMF Team</p>
    </div>
    <div class="noprint">
      <span class="keystate" id="keyState">Locked</span>
      <button class="ghost" id="btnVault">Unlock</button>
      <a class="btn ghost" href="admin.php?action=logout">Sign out</a>
    </div>
  </div>

  <!-- ============================================================
       The key vault.

       The old way was a file: find tmf-private-key.pem, click Load,
       every single time, on every computer. In practice that means the
       key ends up living in Downloads for ever, which is the one place
       it must not.

       Now the key is stored in this browser, wrapped in a passphrase
       only John knows, and unlocked by typing that passphrase. The
       server still never sees the key and still cannot decrypt
       anything — that invariant is untouched. What changes is that the
       file can go back in the safe.
       ============================================================ -->
  <div class="card noprint" id="vault">
    <div class="top" style="margin-bottom:0">
      <span class="mono-label" id="vaultTitle">Unlock the encrypted applications</span>
      <button class="ghost" id="vaultClose" style="padding:6px 12px;font-size:.85rem">Close</button>
    </div>

    <!-- Everyday path: the key is already on this device. -->
    <div id="vaultUnlock" class="hide" style="margin-top:14px">
      <p class="muted" style="margin:0 0 10px;font-size:.92rem">
        Type your passphrase to open applications on this computer.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="password" id="vaultPass" placeholder="Your passphrase"
               autocomplete="current-password" style="flex:1;min-width:220px">
        <button class="primary" id="btnUnlock">Unlock</button>
      </div>
      <p class="bad hide" id="vaultUnlockErr"></p>
      <p style="margin-top:12px">
        <button class="ghost" id="btnForget" style="padding:7px 13px;font-size:.85rem">Forget the key on this computer</button>
      </p>
    </div>

    <!-- First time on a device, or after Forget. -->
    <div id="vaultSetup" class="hide" style="margin-top:14px">
      <p class="muted" style="margin:0 0 12px;font-size:.92rem">
        One time only. Choose your private key file, pick a passphrase, and this
        computer remembers the key from then on — you will only ever type the
        passphrase again. Keep the key file itself somewhere safe and offline;
        it is the only copy and nobody can replace it.
      </p>
      <label class="file">
        <input type="file" id="privFile" accept=".pem,.txt">
        <span id="privLabel">Choose your private key file</span>
      </label>
      <div style="display:grid;gap:8px;margin-top:12px;max-width:420px">
        <input type="password" id="setupPass" placeholder="Choose a passphrase (12 characters or more)" autocomplete="new-password">
        <input type="password" id="setupPass2" placeholder="Type the passphrase again" autocomplete="new-password">
        <button class="primary" id="btnStore">Remember this key on this computer</button>
      </div>
      <p class="bad hide" id="vaultSetupErr"></p>
      <div class="warn" style="margin-top:14px">
        <b>There is no reset.</b> If you forget the passphrase, nothing is lost as
        long as you still have the key file — click <i>Forget the key on this
        computer</i> and set it up again. If you lose the key file as well, every
        application already received becomes permanently unreadable, by design.
      </div>
      <p style="margin-top:12px">
        <button class="ghost" id="btnOnce" style="padding:7px 13px;font-size:.85rem">Just use the file this once, do not remember it</button>
      </p>
    </div>
  </div>

  <div class="warn noprint">
    Your private key is unwrapped in this browser and never sent anywhere. The
    server does not have it and cannot open an application for you — that is the
    point. Without it you can still see who applied; you just cannot read the
    encrypted half.
  </div>

  <div class="tabs noprint">
    <div class="tab on" data-tab="applications">Applications</div>
    <div class="tab" data-tab="leads">Calculators &amp; contact</div>
    <div class="tab" data-tab="chats">Live chat <span id="chatBadge" class="hide"></span></div>
  </div>

  <div class="card" id="paneApplications">
    <div class="noprint"><input type="search" id="searchApps" placeholder="Search by business, name, email or reference"></div>
    <p class="muted" id="appsEmpty" style="margin-top:16px">Loading…</p>
    <table class="hide" id="appsTable">
      <thead><tr><th>Received</th><th>Business</th><th>Owner</th><th>State</th><th>Wanted</th><th>Statements</th><th>Ref</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <div class="card hide" id="paneLeads">
    <div class="noprint" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <input type="search" id="searchLeads" placeholder="Search leads" style="flex:1;min-width:220px">
      <a class="btn ghost" id="csvLink" href="#">Download this month as CSV</a>
    </div>
    <p class="muted" id="leadsEmpty" style="margin-top:16px">Loading…</p>
    <table class="hide" id="leadsTable">
      <thead><tr><th>Received</th><th>Type</th><th>Name</th><th>Business</th><th>Email</th><th>Phone</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <div class="card hide" id="paneChats">
    <div style="display:grid;grid-template-columns:300px 1fr;gap:20px;min-height:440px">
      <div style="border-right:1px solid var(--line);padding-right:16px">
        <span class="mono-label">Conversations</span>
        <p class="muted" id="chatsEmpty" style="margin-top:14px;font-size:.9rem">Loading…</p>
        <div id="chatsList" style="margin-top:10px;max-height:520px;overflow:auto"></div>
      </div>
      <div>
        <div class="top" style="margin-bottom:8px">
          <span class="mono-label" id="chatWho">Pick a conversation</span>
          <div>
            <button class="ghost hide" id="btnTake">Take over</button>
            <button class="ghost hide" id="btnRelease">Hand back to the assistant</button>
          </div>
        </div>
        <div id="chatLog" style="background:#08080a;border:1px solid var(--line);border-radius:var(--radius);
             padding:14px;height:390px;overflow:auto;display:flex;flex-direction:column;gap:10px"></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <input type="search" id="chatText" placeholder="Type a reply — this takes the conversation over"
                 style="flex:1;font:inherit;background:#08080a;color:var(--fg);border:1px solid var(--line);
                        border-radius:var(--radius);padding:11px 13px">
          <button class="primary" id="chatSend">Send</button>
        </div>
        <p class="muted" style="font-size:.82rem;margin-top:8px">
          The moment you send, the assistant stops replying in this conversation. Hand it back when you are done.
        </p>
      </div>
    </div>
  </div>

  <dialog id="viewer">
    <div class="card" style="margin:0;max-height:88vh;overflow:auto">
      <div class="top noprint">
        <span class="mono-label">Application</span>
        <div>
          <button class="ghost" onclick="window.print()">Print / PDF</button>
          <button class="ghost" id="closeViewer">Close</button>
        </div>
      </div>
      <p class="bad hide" id="viewErr"></p>
      <div id="viewBody"></div>
    </div>
  </dialog>

<?php endif; ?>

</div>

<?php if ($authed): ?>
<script>
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  var subtle = window.crypto && window.crypto.subtle;
  var privKey = null;          // CryptoKey, memory only
  var apps = [], leads = [];

  /* ============================================================
     KEY VAULT

     What the server knows: nothing. It stores ciphertext and serves
     ciphertext. Everything below happens in this browser.

     What is kept on this device (localStorage, key tmf_admin_key_v2):
     the PKCS#8 private key, encrypted with AES-256-GCM under a key
     derived from John's passphrase by PBKDF2-SHA256 at 310,000
     iterations with a random 16-byte salt. Without the passphrase that
     blob is useless; with a weak passphrase it is only as strong as the
     passphrase, which is why setup insists on 12 characters.

     The unwrapped CryptoKey lives in the `privKey` variable and nowhere
     else — it is imported non-extractable, so even this page's own code
     cannot read the bytes back out, and it is dropped on lock, on
     inactivity and on page close.
     ============================================================ */
  var VAULT_KEY   = 'tmf_admin_key_v2';
  var PBKDF2_ITER = 310000;
  var IDLE_MS     = 20 * 60 * 1000;      // re-lock after 20 quiet minutes

  function fromPem(pem) {
    var b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function b64ToBuf(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bufToB64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }

  /* The private key as a CryptoKey. Non-extractable: once it is in, the
     bytes cannot come back out of the browser. */
  function importPrivate(pkcs8) {
    return subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-1' }, false, ['decrypt']);
  }

  function deriveWrapKey(passphrase, salt) {
    return subtle.importKey('raw', new TextEncoder().encode(passphrase),
                            { name: 'PBKDF2' }, false, ['deriveKey'])
      .then(function (base) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
          base,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      });
  }

  function storedVault() {
    try { return JSON.parse(localStorage.getItem(VAULT_KEY) || 'null'); } catch (_) { return null; }
  }

  function wrapAndStore(pkcs8, passphrase) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv   = crypto.getRandomValues(new Uint8Array(12));
    return deriveWrapKey(passphrase, salt)
      .then(function (wk) { return subtle.encrypt({ name: 'AES-GCM', iv: iv }, wk, pkcs8); })
      .then(function (ct) {
        localStorage.setItem(VAULT_KEY, JSON.stringify({
          v: 2,
          iter: PBKDF2_ITER,
          salt: bufToB64(salt),
          iv: bufToB64(iv),
          data: bufToB64(ct),
          at: new Date().toISOString()
        }));
      });
  }

  function unwrap(passphrase) {
    var v = storedVault();
    if (!v) return Promise.reject(new Error('nothing stored on this device'));
    return deriveWrapKey(passphrase, b64ToBuf(v.salt))
      .then(function (wk) {
        return subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(v.iv) }, wk, b64ToBuf(v.data));
      })
      .then(importPrivate);
  }

  /* ---------- lock state ---------- */
  var idleTimer = null;

  function setLocked(locked) {
    if (locked) privKey = null;
    $('keyState').textContent = locked ? 'Locked' : 'Unlocked';
    $('keyState').className = 'keystate' + (locked ? '' : ' on');
    $('btnVault').textContent = locked ? 'Unlock' : 'Lock';
    if (locked && idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (!locked) touchIdle();
  }

  function touchIdle() {
    if (!privKey) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      setLocked(true);
      showVault(true);
      $('vaultTitle').textContent = 'Locked again after 20 quiet minutes';
    }, IDLE_MS);
  }
  ['click', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, touchIdle, true);
  });

  /* ---------- the panel ---------- */
  function showVault(show) {
    var have = !!storedVault();
    $('vault').classList.toggle('hide', !show);
    if (!show) return;
    $('vaultUnlock').classList.toggle('hide', !have);
    $('vaultSetup').classList.toggle('hide', have);
    $('vaultTitle').textContent = have
      ? 'Unlock the encrypted applications'
      : 'Set this computer up, once';
    if (have) setTimeout(function () { $('vaultPass').focus(); }, 50);
  }

  function vaultErr(id, msg) {
    var el = $(id);
    el.textContent = msg || '';
    el.classList.toggle('hide', !msg);
  }

  $('btnVault').addEventListener('click', function () {
    if (privKey) { setLocked(true); showVault(false); return; }
    showVault($('vault').classList.contains('hide'));
  });
  $('vaultClose').addEventListener('click', function () { showVault(false); });

  /* ---------- unlock ---------- */
  function doUnlock() {
    var pass = $('vaultPass').value;
    if (!pass) return;
    vaultErr('vaultUnlockErr', '');
    $('btnUnlock').disabled = true;
    $('btnUnlock').textContent = 'Unlocking…';
    unwrap(pass).then(
      function (k) {
        privKey = k;
        $('vaultPass').value = '';
        $('btnUnlock').disabled = false;
        $('btnUnlock').textContent = 'Unlock';
        setLocked(false);
        showVault(false);
      },
      function () {
        $('btnUnlock').disabled = false;
        $('btnUnlock').textContent = 'Unlock';
        vaultErr('vaultUnlockErr',
          'That passphrase does not open the key stored on this computer. ' +
          'If you have forgotten it, click "Forget the key on this computer" and set it up ' +
          'again from your key file.');
      }
    );
  }
  $('btnUnlock').addEventListener('click', doUnlock);
  $('vaultPass').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doUnlock(); }
  });

  $('btnForget').addEventListener('click', function () {
    if (!confirm('Remove the stored key from this computer?\n\n' +
                 'You will need your key file to set it up again. Nothing on the ' +
                 'server changes and no application is lost.')) return;
    localStorage.removeItem(VAULT_KEY);
    setLocked(true);
    showVault(true);
  });

  /* ---------- setup ---------- */
  var pendingPkcs8 = null;       // the chosen key file, not yet stored

  $('privFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var text = String(r.result);
      if (text.indexOf('PRIVATE KEY') === -1) {
        pendingPkcs8 = null;
        $('privLabel').textContent = 'That file is not a private key';
        return;
      }
      var pkcs8;
      try { pkcs8 = fromPem(text); } catch (_) {
        pendingPkcs8 = null;
        $('privLabel').textContent = 'That key could not be read';
        return;
      }
      // Prove it is a usable key before offering to remember it.
      importPrivate(pkcs8).then(
        function () { pendingPkcs8 = pkcs8; $('privLabel').textContent = 'Key file read ✓'; },
        function () { pendingPkcs8 = null; $('privLabel').textContent = 'That key could not be read'; }
      );
    };
    r.readAsText(f);
  });

  $('btnStore').addEventListener('click', function () {
    var a = $('setupPass').value, b = $('setupPass2').value;
    vaultErr('vaultSetupErr', '');
    if (!pendingPkcs8)   return vaultErr('vaultSetupErr', 'Choose your private key file first.');
    if (a.length < 12)   return vaultErr('vaultSetupErr', 'Please use a passphrase of at least 12 characters. Three or four unrelated words is ideal.');
    if (a !== b)         return vaultErr('vaultSetupErr', 'The two passphrases do not match.');

    $('btnStore').disabled = true;
    $('btnStore').textContent = 'Saving…';
    wrapAndStore(pendingPkcs8, a)
      .then(function () { return importPrivate(pendingPkcs8); })
      .then(function (k) {
        privKey = k;
        pendingPkcs8 = null;
        $('setupPass').value = $('setupPass2').value = '';
        $('btnStore').disabled = false;
        $('btnStore').textContent = 'Remember this key on this computer';
        setLocked(false);
        showVault(false);
      })
      .catch(function (e) {
        $('btnStore').disabled = false;
        $('btnStore').textContent = 'Remember this key on this computer';
        vaultErr('vaultSetupErr', 'That could not be saved on this computer. ' + (e.message || e));
      });
  });

  /* Escape hatch: a borrowed computer, where remembering the key would be
     exactly the wrong thing to do. */
  $('btnOnce').addEventListener('click', function () {
    if (!pendingPkcs8) return vaultErr('vaultSetupErr', 'Choose your private key file first.');
    importPrivate(pendingPkcs8).then(function (k) {
      privKey = k;
      pendingPkcs8 = null;
      setLocked(false);
      showVault(false);
    });
  });

  setLocked(true);

  /* ---------- tabs ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      var which = t.getAttribute('data-tab');
      $('paneApplications').classList.toggle('hide', which !== 'applications');
      $('paneLeads').classList.toggle('hide', which !== 'leads');
      $('paneChats').classList.toggle('hide', which !== 'chats');
    });
  });

  /* ---------- loading ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString();
  }

  fetch('admin.php?action=applications', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (rows) { apps = rows; renderApps(''); })
    .catch(function () { $('appsEmpty').textContent = 'Could not load applications.'; });

  fetch('admin.php?action=leads', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (rows) { leads = rows; renderLeads(''); })
    .catch(function () { $('leadsEmpty').textContent = 'Could not load submissions.'; });

  function renderApps(q) {
    var body = $('appsTable').querySelector('tbody');
    var list = apps.filter(function (a) {
      if (!q) return true;
      return (a.business + ' ' + a.owner + ' ' + a.email + ' ' + a.reference).toLowerCase().indexOf(q) !== -1;
    });
    if (!apps.length) {
      $('appsEmpty').textContent = 'No applications yet. When one arrives it will appear here.';
      $('appsTable').classList.add('hide');
      return;
    }
    $('appsEmpty').classList.add('hide');
    $('appsTable').classList.remove('hide');
    body.innerHTML = list.map(function (a) {
      var stmts = a.statements.map(function (n) {
        return '<a class="ref" href="admin.php?action=statement&folder=' + encodeURIComponent(a.folder) +
               '&name=' + encodeURIComponent(n) + '">' + esc(n.slice(0, 2)) + '</a>';
      }).join(' ');
      return '<tr class="row" data-folder="' + esc(a.folder) + '">' +
        '<td>' + esc(when(a.received)) + '</td>' +
        '<td><b>' + esc(a.business) + '</b></td>' +
        '<td>' + esc(a.owner) + '<br><span class="muted" style="font-size:.85rem">' + esc(a.email) + '</span></td>' +
        '<td>' + esc(a.state) + '</td>' +
        '<td>' + (a.amount ? '$' + esc(a.amount) : '') + '</td>' +
        '<td class="noprint">' + (stmts || '<span class="muted">none</span>') + '</td>' +
        '<td class="ref">' + esc(a.reference) + '</td>' +
        '</tr>';
    }).join('');

    Array.prototype.forEach.call(body.querySelectorAll('tr.row'), function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') return;      // statement download
        openApplication(tr.getAttribute('data-folder'));
      });
    });
  }

  function renderLeads(q) {
    var body = $('leadsTable').querySelector('tbody');
    var list = leads.filter(function (l) {
      if (!q) return true;
      return (l.name + ' ' + l.business + ' ' + l.email + ' ' + l.kind).toLowerCase().indexOf(q) !== -1;
    });
    if (!leads.length) {
      $('leadsEmpty').textContent = 'Nothing yet.';
      $('leadsTable').classList.add('hide');
      return;
    }
    $('leadsEmpty').classList.add('hide');
    $('leadsTable').classList.remove('hide');
    $('csvLink').href = 'admin.php?action=csv&month=' + encodeURIComponent(leads[0].month);
    body.innerHTML = list.map(function (l) {
      return '<tr>' +
        '<td>' + esc(when(l.received)) + '</td>' +
        '<td>' + esc(l.kind) + '</td>' +
        '<td>' + esc(l.name) + '</td>' +
        '<td>' + esc(l.business) + '</td>' +
        '<td>' + esc(l.email) + '</td>' +
        '<td>' + esc(l.phone) + '</td>' +
        '</tr>';
    }).join('');
  }

  $('searchApps').addEventListener('input', function () { renderApps(this.value.toLowerCase()); });
  $('searchLeads').addEventListener('input', function () { renderLeads(this.value.toLowerCase()); });

  /* ---------- open one, decrypting here in the browser ---------- */
  var SENSITIVE = /ssn|dob|birth|social|signature/i;
  var GROUPS = [
    { title: 'Business', keys: ['business_legal_name','business_dba_name','ein','industry','business_start_date','business_address','business_city','business_state','business_zip'] },
    { title: 'Owner', keys: ['owner_name','owner_dob','owner_ssn','owner_ownership_pct','email','phone','owner_address','owner_city','owner_state','owner_zip'] },
    { title: 'Co-owner', keys: ['co_owner','co_owner_name','co_owner_dob','co_owner_ssn','co_owner_ownership_pct','co_owner_address','co_owner_city','co_owner_state','co_owner_zip'] },
    { title: 'Request', keys: ['amount_requested','statements_attached'] },
    { title: 'Consent and signing', keys: ['consent_credit','consent_contact','consent_text_id','signed_at'] }
  ];
  function pretty(k) {
    return k.replace(/_/g, ' ').replace(/\bssn\b/i, 'SSN').replace(/\bdob\b/i, 'date of birth')
            .replace(/\bein\b/i, 'EIN').replace(/\bpct\b/i, '%')
            .replace(/^./, function (c) { return c.toUpperCase(); });
  }
  /* Sensitive values are rendered covered. The value is in the DOM either
     way — it has already been decrypted at this point — but it is not on
     the screen until somebody asks for it, which is the difference between
     a colleague walking past and a colleague reading an SSN. */
  function rows(obj, keys) {
    var html = '';
    keys.forEach(function (k) {
      if (!(k in obj) || obj[k] === '' || k === 'owner_signature') return;
      var cell;
      if (SENSITIVE.test(k)) {
        cell = '<td class="ok"><button type="button" class="veil" data-veil>Show</button>' +
               '<span class="hide" data-veiled>' + esc(obj[k]) + '</span></td>';
      } else {
        cell = '<td>' + esc(obj[k]) + '</td>';
      }
      html += '<tr><td class="k">' + pretty(k) + '</td>' + cell + '</tr>';
    });
    return html ? '<table>' + html + '</table>' : '';
  }

  function revealAll(on) {
    Array.prototype.forEach.call($('viewBody').querySelectorAll('[data-veil]'), function (b) {
      b.classList.toggle('hide', on);
    });
    Array.prototype.forEach.call($('viewBody').querySelectorAll('[data-veiled]'), function (v) {
      v.classList.toggle('hide', !on);
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-veil]') : null;
    if (!b) return;
    b.classList.add('hide');
    var v = b.parentNode.querySelector('[data-veiled]');
    if (v) v.classList.remove('hide');
  });

  // Printing a half-covered application would be useless, so everything
  // is uncovered for the print and covered again afterwards.
  window.addEventListener('beforeprint', function () { revealAll(true); });
  window.addEventListener('afterprint', function () { revealAll(false); });

  function openApplication(folder) {
    var dlg = $('viewer');
    $('viewErr').classList.add('hide');
    $('viewErr').textContent = '';        // do not leave a stale message behind
    $('viewBody').innerHTML = '<p class="muted">Opening…</p>';
    if (dlg.showModal) dlg.showModal();

    if (!privKey) {
      $('viewBody').innerHTML = '';
      $('viewErr').textContent = 'Unlock first — the Unlock button at the top right. ' +
        'The server cannot open this for you; it does not have the key, on purpose.';
      $('viewErr').classList.remove('hide');
      return;
    }

    var sealedWith = '';

    fetch('admin.php?action=envelope&folder=' + encodeURIComponent(folder), { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('could not fetch it'); return r.json(); })
      .then(function (env) {
        sealedWith = env.key_id || '';
        return subtle.decrypt({ name: 'RSA-OAEP' }, privKey, b64ToBuf(env.sealed_key))
          .then(function (raw) { return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']); })
          .then(function (aes) {
            var data = b64ToBuf(env.data), tag = b64ToBuf(env.tag);
            var joined = new Uint8Array(data.length + tag.length);
            joined.set(data, 0); joined.set(tag, data.length);
            return subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(env.iv), tagLength: 128 }, aes, joined);
          });
      })
      .then(function (plain) { render(JSON.parse(new TextDecoder().decode(plain))); })
      .catch(function (e) {
        $('viewBody').innerHTML = '';
        $('viewErr').textContent = 'Could not open this application.\n\n' +
          'The usual cause is that this private key does not match the public key that was on ' +
          'the server when this application came in.' +
          (sealedWith
            ? '\n\nThis one was sealed with key ' + sealedWith + '. Open an application that ' +
              'does work and compare the code: if they differ, the key on the server was ' +
              'changed at some point and this file needs the older private key.'
            : '') +
          '\n\nTechnical detail: ' + (e.message || e);
        $('viewErr').classList.remove('hide');
      });
  }

  function render(rec) {
    var app = rec.application || {}, out = '';
    out += '<p class="mono-label">Reference</p><p style="font-size:1.3rem;letter-spacing:.08em;margin:2px 0 0">' +
           esc(rec.reference || '') + '</p>';
    GROUPS.forEach(function (g) {
      var t = rows(app, g.keys);
      if (t) out += '<div class="group"><h3>' + g.title + '</h3>' + t + '</div>';
    });
    var known = {};
    GROUPS.forEach(function (g) { g.keys.forEach(function (k) { known[k] = 1; }); });
    var extras = Object.keys(app).filter(function (k) { return !known[k] && k !== 'owner_signature'; });
    if (extras.length) out += '<div class="group"><h3>Other fields</h3>' + rows(app, extras) + '</div>';
    if (app.owner_signature) {
      out += '<div class="group"><h3>Signature</h3><div class="sig"><img alt="Applicant signature" src="' +
             esc(app.owner_signature) + '"></div></div>';
    }
    if (rec.audit) out += '<div class="group"><h3>Audit trail</h3>' + rows(rec.audit, Object.keys(rec.audit)) + '</div>';
    $('viewBody').innerHTML = out;
  }

  $('closeViewer').addEventListener('click', function () { $('viewer').close(); });

  /* ================= live chat =================
     Polls twice as often when a conversation is open, because a merchant
     sitting in a chat window notices a ten-second gap and a merchant who
     has wandered off does not. */
  var current = null, chatSeen = 0, chats = [];

  function loadChats() {
    return fetch('admin.php?action=chats', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        chats = rows;
        var waiting = rows.filter(function (c) { return c.waiting; }).length;
        var badge = $('chatBadge');
        badge.textContent = waiting ? ' ' + waiting + ' waiting' : '';
        badge.classList.toggle('hide', !waiting);
        badge.style.color = '#f87171';

        if (!rows.length) {
          $('chatsEmpty').textContent = 'No conversations yet.';
          $('chatsList').innerHTML = '';
          return;
        }
        $('chatsEmpty').classList.add('hide');
        $('chatsList').innerHTML = rows.map(function (c) {
          var tag = c.waiting ? '<span style="color:#f87171">waiting</span>'
                  : c.human ? '<span class="ok">you</span>'
                  : '<span class="muted">assistant</span>';
          return '<div class="chatitem" data-session="' + esc(c.session) + '" ' +
            'style="padding:11px;border:1px solid ' + (c.session === current ? 'var(--accent)' : 'var(--line)') +
            ';border-radius:10px;margin-bottom:8px;cursor:pointer">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;font-size:.82rem">' +
            tag + '<span class="muted">' + esc(when(c.updated)) + '</span></div>' +
            '<div style="font-size:.9rem;margin-top:4px"><b>' + esc(c.name || 'Visitor') + '</b>' +
            (c.phone ? ' <span class="muted">' + esc(c.phone) + '</span>' : '') + '</div>' +
            '<div class="muted" style="font-size:.82rem;margin-top:2px">' + esc(c.last || '') + '</div>' +
            '</div>';
        }).join('');

        Array.prototype.forEach.call(document.querySelectorAll('.chatitem'), function (el) {
          el.addEventListener('click', function () { openChat(el.getAttribute('data-session')); });
        });
      })
      .catch(function () {});
  }

  function openChat(session) {
    if (session !== current) { current = session; chatSeen = 0; $('chatLog').innerHTML = ''; }
    return fetch('admin.php?action=chat&session=' + encodeURIComponent(session), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (t) {
        $('chatWho').textContent = (t.visitor && t.visitor.name ? t.visitor.name : 'Visitor') +
          (t.visitor && t.visitor.phone ? ' · ' + t.visitor.phone : '') + ' · ' + (t.page || '');
        $('btnTake').classList.toggle('hide', !!t.human);
        $('btnRelease').classList.toggle('hide', !t.human);

        var log = $('chatLog');
        (t.messages || []).slice(chatSeen).forEach(function (m) {
          var el = document.createElement('div');
          var mine = m.role === 'operator';
          var sys = m.role === 'system';
          el.style.cssText = 'max-width:82%;padding:9px 12px;border-radius:12px;font-size:.9rem;white-space:pre-wrap;' +
            (sys ? 'align-self:center;color:var(--muted);font-size:.8rem;text-align:center;max-width:100%'
                 : mine ? 'align-self:flex-end;background:rgba(74,165,232,.16);border:1px solid rgba(74,165,232,.4)'
                 : m.role === 'visitor' ? 'align-self:flex-start;background:var(--panel-2);border:1px solid var(--line)'
                 : 'align-self:flex-start;background:rgba(52,211,153,.09);border:1px solid rgba(52,211,153,.28)');
          el.textContent = (m.role === 'assistant' ? 'Assistant: ' : '') + m.text;
          log.appendChild(el);
        });
        chatSeen = (t.messages || []).length;
        log.scrollTop = log.scrollHeight;
      })
      .catch(function () {});
  }

  function chatAction(action, extra) {
    if (!current) return Promise.resolve();
    var body = new URLSearchParams();
    body.set('session', current);
    Object.keys(extra || {}).forEach(function (k) { body.set(k, extra[k]); });
    return fetch('admin.php?action=' + action, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    }).then(function () { return openChat(current); }).then(loadChats);
  }

  $('btnTake').addEventListener('click', function () { chatAction('chattake'); });
  $('btnRelease').addEventListener('click', function () { chatAction('chatrelease'); });
  $('chatSend').addEventListener('click', function () {
    var v = $('chatText').value.trim();
    if (!v) return;
    $('chatText').value = '';
    chatAction('chatsend', { text: v });
  });
  $('chatText').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('chatSend').click(); }
  });

  loadChats();
  setInterval(function () {
    loadChats();
    if (current && !$('paneChats').classList.contains('hide')) openChat(current);
  }, 5000);
})();
</script>
<?php endif; ?>
</body>
</html>
