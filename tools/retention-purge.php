<?php
declare(strict_types=1);

/**
 * Retention dry-run for the protected TMF application store.
 *
 * This command never sends, calls an API, or prints customer data. By default
 * it only reports category/month totals for proposed retention candidates.
 * Applications and opt-outs are never candidates because this site has no
 * reliable funded-status or legal-hold field. See docs/DATA-RETENTION-OPTIONS.md.
 *
 * Usage:
 *   php tools/retention-purge.php --dry-run
 *   php tools/retention-purge.php --dry-run --store=/absolute/protected/store
 *   php tools/retention-purge.php --selftest
 *
 * An authorized operator may use --apply --confirm=PURGE-RETENTION only after
 * the policy decisions documented above are completed. This task never runs it.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

const LEAD_MONTHS = 24;
const CHAT_DAYS = 90;
const APPLY_CONFIRMATION = 'PURGE-RETENTION';

function usage(): never
{
    fwrite(STDERR, "Usage: php tools/retention-purge.php --dry-run [--store=/absolute/path] [--now=YYYY-MM-DD]\n");
    fwrite(STDERR, "       php tools/retention-purge.php --apply --confirm=" . APPLY_CONFIRMATION . " [--store=/absolute/path]\n");
    fwrite(STDERR, "       php tools/retention-purge.php --selftest\n");
    exit(2);
}

function cutoff(string $now, DateInterval $age): int
{
    return (new DateTimeImmutable($now, new DateTimeZone('UTC')))->sub($age)->getTimestamp();
}

/** Return files only; reject symlinks so a retention run cannot cross stores. */
function regularFiles(string $dir): array
{
    if (!is_dir($dir)) {
        return [];
    }
    $files = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($iterator as $item) {
        if ($item->isLink() || !$item->isFile()) {
            continue;
        }
        $files[] = $item->getPathname();
    }
    return $files;
}

/**
 * Return only data that is safe to display: category, month and file path for
 * an optional apply. The output never includes a filename, name, email, phone
 * number, or the file contents.
 */
function candidates(string $store, string $now): array
{
    $leadCutoff = cutoff($now, new DateInterval('P' . LEAD_MONTHS . 'M'));
    $chatCutoff = cutoff($now, new DateInterval('P' . CHAT_DAYS . 'D'));
    $out = [];

    foreach (glob($store . '/leads/????-??', GLOB_ONLYDIR) ?: [] as $monthDir) {
        $month = basename($monthDir);
        foreach (regularFiles($monthDir) as $file) {
            if (pathinfo($file, PATHINFO_EXTENSION) !== 'json' || filemtime($file) >= $leadCutoff) {
                continue;
            }
            $out[] = ['kind' => 'enquiry', 'month' => $month, 'file' => $file];
        }
    }

    foreach (regularFiles($store . '/chats') as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) !== 'json' || filemtime($file) >= $chatCutoff) {
            continue;
        }
        $out[] = ['kind' => 'chat transcript', 'month' => gmdate('Y-m', filemtime($file)), 'file' => $file];
    }
    return $out;
}

function printSummary(array $items, string $mode): void
{
    $summary = [];
    foreach ($items as $item) {
        $key = $item['kind'] . ' | ' . $item['month'];
        $summary[$key] = ($summary[$key] ?? 0) + 1;
    }
    ksort($summary);
    echo strtoupper($mode) . " — proposed retention candidates\n";
    if ($summary === []) {
        echo "  none\n";
    }
    foreach ($summary as $key => $count) {
        echo "  {$key}: {$count} record(s)\n";
    }
    echo "Applications: excluded (no reliable funded-status or legal-hold field).\n";
    echo "Opt-outs: excluded (never auto-delete).\n";
    echo 'Total proposed candidates: ' . count($items) . "\n";
}

function configuredStore(array $options): string
{
    $store = $options['store'] ?? null;
    if (!is_string($store) || $store === '') {
        $config = __DIR__ . '/../api/config.php';
        if (!is_readable($config)) {
            throw new RuntimeException('Protected store is not configured. Use --store=/absolute/path for a dry-run.');
        }
        $cfg = require $config;
        $store = is_array($cfg) ? ($cfg['application_dir'] ?? '') : '';
    }
    if (!is_string($store) || $store === '' || $store[0] !== '/' || !is_dir($store)) {
        throw new RuntimeException('Protected store must be an existing absolute directory.');
    }
    return rtrim($store, '/');
}

function parse(array $argv): array
{
    $opts = ['dry-run' => false, 'apply' => false, 'selftest' => false, 'store' => null, 'now' => gmdate('Y-m-d'), 'confirm' => null];
    foreach (array_slice($argv, 1) as $arg) {
        if (isset($opts[ltrim($arg, '-')]) && str_starts_with($arg, '--')) {
            $opts[ltrim($arg, '-')] = true;
            continue;
        }
        if (preg_match('/^--(store|now|confirm)=(.*)$/', $arg, $match)) {
            $opts[$match[1]] = $match[2];
            continue;
        }
        usage();
    }
    if ($opts['selftest']) {
        return $opts;
    }
    if ((!$opts['dry-run'] && !$opts['apply']) || ($opts['dry-run'] && $opts['apply'])) {
        usage();
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $opts['now'])) {
        usage();
    }
    return $opts;
}

function selftest(): void
{
    $root = sys_get_temp_dir() . '/tmf-retention-' . bin2hex(random_bytes(6));
    mkdir($root . '/leads/2024-01', 0700, true);
    mkdir($root . '/chats/aa', 0700, true);
    file_put_contents($root . '/leads/2024-01/old.json', '{}');
    file_put_contents($root . '/leads/2024-01/new.json', '{}');
    file_put_contents($root . '/chats/aa/old.json', '{}');
    touch($root . '/leads/2024-01/old.json', strtotime('2024-01-01 UTC'));
    touch($root . '/leads/2024-01/new.json', strtotime('2026-01-01 UTC'));
    touch($root . '/chats/aa/old.json', strtotime('2025-01-01 UTC'));
    $items = candidates($root, '2026-03-01');
    $names = array_map(static fn(array $item): string => basename($item['file']), $items);
    if ($names !== ['old.json', 'old.json'] || !is_file($root . '/leads/2024-01/old.json')) {
        throw new RuntimeException('self-test failed');
    }
    foreach (array_reverse(regularFiles($root)) as $file) {
        unlink($file);
    }
    rmdir($root . '/chats/aa');
    rmdir($root . '/chats');
    rmdir($root . '/leads/2024-01');
    rmdir($root . '/leads');
    rmdir($root);
    echo "retention-purge self-test: OK (dry-run candidates only; no file deleted)\n";
}

try {
    $options = parse($argv);
    if ($options['selftest']) {
        selftest();
        exit(0);
    }
    $store = configuredStore($options);
    $items = candidates($store, (string) $options['now']);
    if ($options['apply']) {
        if ($options['confirm'] !== APPLY_CONFIRMATION) {
            throw new RuntimeException('--apply requires --confirm=' . APPLY_CONFIRMATION . '. No files were changed.');
        }
        foreach ($items as $item) {
            if (!unlink($item['file'])) {
                throw new RuntimeException('Could not remove a proposed record. Stop and investigate before retrying.');
            }
        }
        printSummary($items, 'apply');
    } else {
        printSummary($items, 'dry-run');
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'retention-purge: ' . $error->getMessage() . "\n");
    exit(1);
}
