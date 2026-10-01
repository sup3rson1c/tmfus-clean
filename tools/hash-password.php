<?php
declare(strict_types=1);

/**
 * Turn the admin.php password into a hash, so api/config.php no longer has
 * to hold the password itself in plain text.
 *
 *   php tools/hash-password.php            bcrypt (works on every PHP)
 *   php tools/hash-password.php --argon2id Argon2id, if this PHP has it
 *
 * It asks for the password twice and does not show it while you type.
 * Never pass the password on the command line: it would be saved in your
 * shell history.
 *
 * Put the output in api/config.php by hand:
 *     'admin_password_hash' => '$2y$12$....',
 * and set 'admin_password' => '' . admin.php prefers the hash when both are set.
 *
 * Use the SAME password as before, or the key saved in your browser (which
 * is wrapped under the admin password) will need setting up again.
 *
 * Command line only. It refuses to run from a web browser, and tools/ is
 * never deployed to public_html anyway.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$args = array_slice($argv, 1);
$argon = in_array('--argon2id', $args, true);
if (array_diff($args, ['--argon2id']) !== []) {
    fwrite(STDERR, "Usage: php tools/hash-password.php [--argon2id]\n");
    exit(2);
}
if ($argon && !defined('PASSWORD_ARGON2ID')) {
    fwrite(STDERR, "This PHP was built without Argon2id. Run it without --argon2id (bcrypt is fine).\n");
    exit(1);
}

/** Read one line without echoing it, where the terminal allows that. */
function ask(string $prompt): string
{
    fwrite(STDERR, $prompt);
    $tty = DIRECTORY_SEPARATOR === '/' && function_exists('posix_isatty') && posix_isatty(STDIN);
    if ($tty) {
        shell_exec('stty -echo 2>/dev/null');
    }
    $line = fgets(STDIN);
    if ($tty) {
        shell_exec('stty echo 2>/dev/null');
        fwrite(STDERR, "\n");
    }
    return rtrim((string) $line, "\r\n");
}

$pass = ask('Admin password: ');
if ($pass === '') {
    fwrite(STDERR, "No password given. Nothing done.\n");
    exit(1);
}
if (stream_isatty(STDIN) && ask('Same again: ') !== $pass) {
    fwrite(STDERR, "The two did not match. Nothing done.\n");
    exit(1);
}
if (!$argon && strlen($pass) > 72) {
    fwrite(STDERR, "Note: bcrypt only uses the first 72 bytes. Use --argon2id, or a shorter password.\n");
    exit(1);
}
if (strlen($pass) < 16) {
    fwrite(STDERR, "Warning: that is short. Four or five unrelated words is better.\n");
}

$hash = $argon
    ? password_hash($pass, PASSWORD_ARGON2ID)
    : password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);

echo "\nPut this line in api/config.php (and set 'admin_password' => ''):\n\n";
echo "    'admin_password_hash' => '" . $hash . "',\n\n";
