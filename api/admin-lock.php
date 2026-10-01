<?php
declare(strict_types=1);

/**
 * The two optional extra locks for admin.php, and the maths behind them.
 * ---------------------------------------------------------------
 * This file only defines functions. admin.php and the command-line tools
 * in tools/ load it; nothing here runs on its own, and a browser that asks
 * for it directly gets a 404 (and .htaccess denies it before PHP runs).
 *
 *   1. IP allow-list  — config key admin_allowed_ips (+ trusted_proxy)
 *   2. TOTP code      — config key admin_totp_secret (RFC 6238: SHA1,
 *                       30-second steps, 6 digits, one step either side)
 *
 * No libraries, no network calls: the code is computed with PHP's own
 * hash_hmac(), exactly the way every authenticator app computes it.
 */

if (PHP_SAPI !== 'cli' && realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    http_response_code(404);
    exit;
}

/* ============================================================
   IP ALLOW-LIST
   ============================================================ */

/** Packed binary address, with IPv4-mapped IPv6 (::ffff:1.2.3.4) folded to IPv4. */
function tmf_ip_bin(string $ip): ?string
{
    $bin = @inet_pton(trim($ip));
    if ($bin === false) {
        return null;
    }
    if (strlen($bin) === 16 && substr($bin, 0, 12) === "\0\0\0\0\0\0\0\0\0\0\xff\xff") {
        $bin = substr($bin, 12);
    }
    return $bin;
}

/** Does $ip fall inside $rule? $rule is one address or a CIDR block (v4 or v6). */
function tmf_ip_matches(string $ip, string $rule): bool
{
    $rule = trim($rule);
    $addr = tmf_ip_bin($ip);
    if ($addr === null || $rule === '') {
        return false;
    }
    $bits = null;
    if (strpos($rule, '/') !== false) {
        [$rule, $len] = explode('/', $rule, 2);
        if (!preg_match('/^\d{1,3}$/', $len)) {
            return false;                       // malformed: matches nothing
        }
        $bits = (int) $len;
    }
    $net = @inet_pton(trim($rule));
    if ($net === false) {
        return false;
    }
    // An IPv4-mapped rule with a prefix (::ffff:10.0.0.0/104) becomes 10.0.0.0/8.
    if (strlen($net) === 16 && substr($net, 0, 12) === "\0\0\0\0\0\0\0\0\0\0\xff\xff") {
        $net = substr($net, 12);
        if ($bits !== null) {
            if ($bits < 96) {
                return false;
            }
            $bits -= 96;
        }
    }
    if (strlen($net) !== strlen($addr)) {
        return false;                           // IPv4 rule never matches IPv6 and back
    }
    $max = strlen($net) * 8;
    $bits = $bits ?? $max;
    if ($bits > $max) {
        return false;
    }
    $whole = intdiv($bits, 8);
    if (substr($addr, 0, $whole) !== substr($net, 0, $whole)) {
        return false;
    }
    $rest = $bits % 8;
    if ($rest === 0) {
        return true;
    }
    $mask = (0xff << (8 - $rest)) & 0xff;
    return (ord($addr[$whole]) & $mask) === (ord($net[$whole]) & $mask);
}

/** Is $ip covered by any rule in $rules? Garbage rules match nothing. */
function tmf_ip_in_list(string $ip, array $rules): bool
{
    foreach ($rules as $rule) {
        if (is_string($rule) && tmf_ip_matches($ip, $rule)) {
            return true;
        }
    }
    return false;
}

/** Normalise a config value that may be one string or a list into a list. */
function tmf_list($value): array
{
    if (is_string($value)) {
        $value = trim($value) === '' ? [] : [$value];
    }
    return is_array($value) ? array_values(array_filter($value, 'is_string')) : [];
}

/**
 * The address of whoever is really on the other end.
 *
 * REMOTE_ADDR only — it is set by the server from the TCP connection and
 * cannot be forged by the browser. X-Forwarded-For is a header anyone can
 * type, so it is read ONLY when the connection itself comes from a proxy
 * named in trusted_proxy. Even then we walk it from the right (the entry
 * the trusted proxy appended) and stop at the first address that is not
 * another trusted proxy.
 */
function tmf_client_ip(array $server, $trustedProxy): string
{
    $remote = (string) ($server['REMOTE_ADDR'] ?? '');
    $proxies = tmf_list($trustedProxy);
    if ($proxies === [] || !tmf_ip_in_list($remote, $proxies)) {
        return $remote;
    }
    $chain = array_map('trim', explode(',', (string) ($server['HTTP_X_FORWARDED_FOR'] ?? '')));
    for ($i = count($chain) - 1; $i >= 0; $i--) {
        $hop = $chain[$i];
        if (tmf_ip_bin($hop) === null) {
            return $remote;                     // junk in the chain: trust nothing past it
        }
        if (!tmf_ip_in_list($hop, $proxies)) {
            return $hop;
        }
    }
    return $remote;
}

/* ============================================================
   TOTP (RFC 6238 on top of RFC 4226 HOTP)
   ============================================================ */

const TMF_B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 text → raw bytes. Spaces, dashes, '=' and case are ignored. null if invalid. */
function tmf_base32_decode(string $text): ?string
{
    $text = strtoupper(preg_replace('/[\s=-]+/', '', $text) ?? '');
    if ($text === '' || strspn($text, TMF_B32) !== strlen($text)) {
        return null;
    }
    $bits = '';
    foreach (str_split($text) as $ch) {
        $bits .= str_pad(decbin(strpos(TMF_B32, $ch)), 5, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 8) as $byte) {
        if (strlen($byte) === 8) {
            $out .= chr(bindec($byte));
        }
    }
    return $out;
}

/** Raw bytes → base32 text, no padding (what authenticator apps expect). */
function tmf_base32_encode(string $bytes): string
{
    $bits = '';
    foreach (str_split($bytes) as $ch) {
        $bits .= str_pad(decbin(ord($ch)), 8, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 5) as $chunk) {
        $out .= TMF_B32[bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))];
    }
    return $out;
}

/** RFC 4226 HOTP: the code for one counter value. */
function tmf_hotp(string $key, int $counter, int $digits = 6): string
{
    $msg = pack('N2', ($counter >> 32) & 0xffffffff, $counter & 0xffffffff);
    $h = hash_hmac('sha1', $msg, $key, true);
    $o = ord($h[19]) & 0x0f;
    $n = ((ord($h[$o]) & 0x7f) << 24) | (ord($h[$o + 1]) << 16)
       | (ord($h[$o + 2]) << 8) | ord($h[$o + 3]);
    return str_pad((string) ($n % (10 ** $digits)), $digits, '0', STR_PAD_LEFT);
}

/** RFC 6238 TOTP: the code for a moment in time. */
function tmf_totp(string $key, int $time, int $digits = 6, int $period = 30): string
{
    return tmf_hotp($key, intdiv($time, $period), $digits);
}

/**
 * Check a typed 6-digit code against the secret, allowing one 30-second
 * step either side for clock drift. Returns the time step that matched
 * (so the caller can refuse to accept the same code twice), or null.
 */
function tmf_totp_verify(string $key, string $given, int $time): ?int
{
    $given = preg_replace('/\s+/', '', $given) ?? '';
    if (!preg_match('/^\d{6}$/', $given)) {
        return null;
    }
    $step = intdiv($time, 30);
    $hit = null;
    foreach ([-1, 0, 1] as $d) {
        // Check all three without stopping early, so timing says nothing.
        if (hash_equals(tmf_hotp($key, $step + $d), $given)) {
            $hit = $step + $d;
        }
    }
    return $hit;
}

/**
 * Self-check against the published test vectors. Returns a list of
 * failures; an empty list means every vector matched.
 */
function tmf_admin_lock_selftest(): array
{
    $bad = [];
    // RFC 6238 Appendix B, SHA1 column. Secret is the ASCII "12345678901234567890", 8 digits.
    $key = '12345678901234567890';
    $vectors = [
        59          => '94287082',
        1111111109  => '07081804',
        1111111111  => '14050471',
        1234567890  => '89005924',
        2000000000  => '69279037',
        20000000000 => '65353130',
    ];
    foreach ($vectors as $t => $want) {
        $got = tmf_totp($key, $t, 8);
        if ($got !== $want) {
            $bad[] = "RFC 6238 T=$t: want $want, got $got";
        }
    }
    // RFC 4226 Appendix D, first HOTP values (6 digits).
    foreach (['755224', '287082', '359152', '969429', '338314'] as $c => $want) {
        $got = tmf_hotp($key, $c);
        if ($got !== $want) {
            $bad[] = "RFC 4226 counter=$c: want $want, got $got";
        }
    }
    // Base32 round trip (RFC 4648 test vector), and the same key as an app sees it.
    if (tmf_base32_encode('foobar') !== 'MZXW6YTBOI') {
        $bad[] = 'base32 encode of "foobar"';
    }
    if (tmf_base32_decode('mzxw 6ytb oi======') !== 'foobar') {
        $bad[] = 'base32 decode of "MZXW6YTBOI"';
    }
    if (tmf_base32_decode('not base32!') !== null || tmf_base32_decode('') !== null) {
        $bad[] = 'base32 decode accepted garbage';
    }
    $b32 = tmf_base32_decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'); // = "12345678901234567890"
    if ($b32 !== $key) {
        $bad[] = 'base32 decode of the RFC key';
    }
    // The ±1 step window and its edges.
    $t = 1111111111;
    if (tmf_totp_verify($key, tmf_totp($key, $t), $t) !== intdiv($t, 30)) {
        $bad[] = 'verify rejects the current code';
    }
    if (tmf_totp_verify($key, tmf_totp($key, $t - 30), $t) === null
        || tmf_totp_verify($key, tmf_totp($key, $t + 30), $t) === null) {
        $bad[] = 'verify rejects a code one step away';
    }
    if (tmf_totp_verify($key, tmf_totp($key, $t - 90), $t) !== null) {
        $bad[] = 'verify accepts a code three steps old';
    }
    if (tmf_totp_verify($key, 'abcdef', $t) !== null || tmf_totp_verify($key, '12345', $t) !== null) {
        $bad[] = 'verify accepts a malformed code';
    }
    // IP matching.
    $ipCases = [
        ['203.0.113.7',  '203.0.113.7',       true],
        ['203.0.113.7',  '203.0.113.0/24',    true],
        ['203.0.114.7',  '203.0.113.0/24',    false],
        ['10.1.2.3',     '10.0.0.0/8',        true],
        ['10.1.2.3',     '0.0.0.0/0',         true],
        ['192.168.1.9',  '192.168.1.8/31',    true],
        ['192.168.1.10', '192.168.1.8/31',    false],
        ['::ffff:10.1.2.3', '10.0.0.0/8',     true],
        ['2001:db8::1',  '2001:db8::/32',     true],
        ['2001:db9::1',  '2001:db8::/32',     false],
        ['2001:db8::1',  '2001:db8::1',       true],
        ['2001:db8::1',  '10.0.0.0/8',        false],
        ['10.1.2.3',     '::/0',              false],
        ['10.1.2.3',     '10.0.0.0/33',       false],
        ['10.1.2.3',     'not an ip',         false],
        ['garbage',      '0.0.0.0/0',         false],
    ];
    foreach ($ipCases as [$ip, $rule, $want]) {
        if (tmf_ip_matches($ip, $rule) !== $want) {
            $bad[] = "IP $ip in $rule should be " . ($want ? 'yes' : 'no');
        }
    }
    // X-Forwarded-For is ignored unless the connection comes from a trusted proxy.
    $srv = ['REMOTE_ADDR' => '198.51.100.9', 'HTTP_X_FORWARDED_FOR' => '203.0.113.7'];
    if (tmf_client_ip($srv, '') !== '198.51.100.9') {
        $bad[] = 'X-Forwarded-For trusted with no trusted_proxy set';
    }
    if (tmf_client_ip($srv, '192.0.2.1') !== '198.51.100.9') {
        $bad[] = 'X-Forwarded-For trusted from an untrusted connection';
    }
    if (tmf_client_ip($srv, '198.51.100.9') !== '203.0.113.7') {
        $bad[] = 'X-Forwarded-For ignored from the trusted proxy';
    }
    $srv['HTTP_X_FORWARDED_FOR'] = '1.2.3.4, 203.0.113.7';     // browser forged the first entry
    if (tmf_client_ip($srv, ['198.51.100.9']) !== '203.0.113.7') {
        $bad[] = 'X-Forwarded-For read from the left (forgeable end)';
    }
    return $bad;
}
