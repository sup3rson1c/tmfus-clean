<?php
declare(strict_types=1);

/**
 * Make a secret for the admin.php two-step code, and show how to add it
 * to an authenticator app (Google Authenticator, Microsoft Authenticator,
 * 1Password, Authy, ...).
 *
 *   php tools/totp-setup.php              make a new secret
 *   php tools/totp-setup.php --selftest   check the maths against the RFC test vectors
 *
 * Command line only. It refuses to run from a web browser, and tools/ is
 * never deployed to public_html anyway (.cpanel.yml skips it, .htaccess
 * 404s it).
 *
 * It prints the secret and never saves it. YOU put it into api/config.php
 * by hand:   'admin_totp_secret' => 'THE SECRET',
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../api/admin-lock.php';

$args = array_slice($argv, 1);

if (in_array('--selftest', $args, true)) {
    $bad = tmf_admin_lock_selftest();
    if ($bad === []) {
        echo "admin-lock self-test: OK (RFC 6238 + RFC 4226 vectors, base32, IP allow-list)\n";
        exit(0);
    }
    fwrite(STDERR, "admin-lock self-test FAILED:\n  - " . implode("\n  - ", $bad) . "\n");
    exit(1);
}

if ($args !== []) {
    fwrite(STDERR, "Usage: php tools/totp-setup.php [--selftest]\n");
    exit(2);
}

$secret = tmf_base32_encode(random_bytes(20));   // 160 bits, as RFC 4226 recommends
$label  = rawurlencode('TMF Team') . ':' . rawurlencode('admin');
$uri    = 'otpauth://totp/' . $label . '?secret=' . $secret
        . '&issuer=' . rawurlencode('TMF Team') . '&algorithm=SHA1&digits=6&period=30';
$now    = tmf_totp((string) tmf_base32_decode($secret), time());

echo <<<TXT

  New two-step secret for admin.php
  ---------------------------------

  1. On your phone, open your authenticator app and choose "Add account",
     then "Enter a setup key" (not "Scan a QR code").
       Account name:  TMF Team admin
       Key:           {$secret}
       Type:          Time based
     (Or, if your app can open a link, give it this:)
       {$uri}

  2. The app should now show:  {$now}   (it changes every 30 seconds,
     so if it has moved on already, that is fine).

  3. Open api/config.php ON THE SERVER and set, by hand:

       'admin_totp_secret' => '{$secret}',

     Save. From the next sign-in, admin.php asks for the code.

  This secret is NOT saved anywhere by this tool. Do not email it or put
  it in a chat. Clear this screen when you are done. To switch the code
  off again, set the line back to ''.

TXT;
