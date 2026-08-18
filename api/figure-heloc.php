<?php
declare(strict_types=1);

/**
 * Figure HELOC pre-qualification proxy
 * ---------------------------------------------------------------
 * The browser posts borrower details here; this file adds the affiliate
 * ID and forwards to Figure, then returns just the offers.
 *
 * It exists because the affiliate ID travels in the request BODY of
 * Figure's API. Calling that API from JavaScript would publish the key
 * to every visitor. It must stay server-side.
 *
 * Endpoint:  POST /api/figure-heloc.php
 * Docs:      https://docs.figure.com/heloc-pre-qualification/api
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/**
 * v1 takes a plain JSON body (HelocOfferRequest).
 * v2 takes ONLY an encrypted body ({"encrypted": "<JWE>"}) — posting plain
 * JSON to it returns 400 "Malformed input". Using v2 would mean implementing
 * JWE with Figure's public key, which is not needed for pre-qualification:
 * no SSN is collected here and the call is already over TLS.
 */
const FIGURE_PATH = '/products/heloc/pre-qualify/v1';

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

function logLine(?array $cfg, string $message): void
{
    if (empty($cfg['log_file'])) {
        return;
    }
    // Never log the affiliate ID, and never log SSN or DOB.
    @file_put_contents(
        $cfg['log_file'],
        gmdate('c') . ' ' . $message . "\n",
        FILE_APPEND | LOCK_EX
    );
}

/* ---------------------------------------------------------------
   Preconditions
   --------------------------------------------------------------- */

/* ---------------------------------------------------------------
   Self-check:  GET /api/figure-heloc.php?selftest=1

   Reports whether the Figure side is configured coherently, in plain
   English. It never returns the affiliate ID — only whether it is
   present, well formed, and pointed at an endpoint that will accept it.
   Safe to leave enabled.
   --------------------------------------------------------------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['selftest'])) {
    $cfgPath = __DIR__ . '/config.php';
    $c = is_file($cfgPath) ? (require $cfgPath) : [];
    $id = strtolower((string) ($c['affiliate_id'] ?? ''));
    $env = (string) ($c['environment'] ?? 'test');
    $prod = $env === 'production';

    $sandboxIds = [
        'd02bc4e9-35af-4c31-970e-e1273079ba41',
        'e5c722ec-eaf1-4cb1-8fcb-f2c16b31fade',
    ];
    $isSandbox = in_array($id, $sandboxIds, true);
    $wellFormed = (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id);

    if (!is_file($cfgPath)) {
        $verdict = 'No api/config.php on the server. Create it before anything else.';
    } elseif ($id === '') {
        $verdict = 'No affiliate_id set in config.php.';
    } elseif (!$wellFormed) {
        $verdict = 'affiliate_id is not a valid 36-character UUID. Check for a stray space or a truncated paste.';
    } elseif ($isSandbox && $prod) {
        $verdict = 'BLOCKED: this is one of Figure\'s published sandbox IDs, pointed at the production API. '
                 . 'Production answers HTTP 500 for sandbox IDs, which looks like a Figure outage and is not one. '
                 . 'Either set environment to test, or put your real affiliate ID from Figure in affiliate_id.';
    } elseif ($isSandbox) {
        $verdict = 'Ready for testing. Sandbox ID against the sandbox API — offers you see are not real quotes.';
    } elseif ($prod) {
        $verdict = 'Ready for live use. A real-looking affiliate ID against the production API.';
    } else {
        $verdict = 'A real-looking affiliate ID pointed at the sandbox API. Set environment to production when you want live offers.';
    }

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'ok'          => !(($isSandbox && $prod) || $id === '' || !$wellFormed || !is_file($cfgPath)),
        'config'      => is_file($cfgPath) ? 'found' : 'MISSING',
        'affiliate_id' => $id === '' ? 'not set' : ($wellFormed ? 'valid format' : 'MALFORMED'),
        'credential'  => $id === '' ? 'none' : ($isSandbox ? 'Figure sandbox (test only)' : 'looks like a real one'),
        'environment' => $env,
        'calling'     => $prod ? 'https://api.figure.com' : 'https://api.test.figure.com',
        'verdict'     => $verdict,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'Method not allowed.');
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    fail(503, 'Figure integration is not configured yet.');
}

$cfg = require $configPath;
$affiliateId = (string) ($cfg['affiliate_id'] ?? '');

if ($affiliateId === '' || str_starts_with($affiliateId, 'PUT-YOUR')) {
    fail(503, 'Figure integration is not configured yet.');
}
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $affiliateId)) {
    logLine($cfg, 'ERROR affiliate_id is not a valid UUID');
    fail(503, 'Figure integration is not configured correctly.');
}

/* ---------------------------------------------------------------
   Sandbox credential pointed at production.

   This cost several sessions. Figure publishes two sandbox affiliate
   IDs in their docs. Sent to api.figure.com they are simply unknown, and
   Figure answers HTTP 500 — which reads like their server falling over
   rather than a credential problem, so the hunt goes off in the wrong
   direction and stays there. Nine payload variations were tested against
   production on a sandbox ID before anyone checked the ID itself.

   Refuse the combination outright and say exactly what is wrong.
   --------------------------------------------------------------- */
const FIGURE_SANDBOX_IDS = [
    'd02bc4e9-35af-4c31-970e-e1273079ba41',  // self-attested model
    'e5c722ec-eaf1-4cb1-8fcb-f2c16b31fade',  // licensed partners
];

$isSandboxId = in_array(strtolower($affiliateId), FIGURE_SANDBOX_IDS, true);
$isProduction = ($cfg['environment'] ?? 'test') === 'production';

if ($isSandboxId && $isProduction) {
    logLine(
        $cfg,
        'ERROR refusing to call production with a published sandbox affiliate_id. '
        . "Set 'environment' => 'test' in config.php to use this ID, or put your real "
        . 'affiliate ID from Figure in affiliate_id to go live. Production returns HTTP '
        . '500 for sandbox IDs, which looks like a Figure outage and is not one.'
    );
    fail(503, 'The HELOC offers service is not configured for live use yet.');
}

/* ---------------------------------------------------------------
   Rate limit — cheap, per IP, per hour
   --------------------------------------------------------------- */

$limit = (int) ($cfg['rate_limit_per_hour'] ?? 20);
if ($limit > 0) {
    $ip  = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $key = sys_get_temp_dir() . '/figure_rl_' . hash('sha256', $ip . gmdate('YmdH'));
    $n   = is_file($key) ? (int) file_get_contents($key) : 0;
    if ($n >= $limit) {
        fail(429, 'Too many requests. Please try again shortly.');
    }
    @file_put_contents($key, (string) ($n + 1), LOCK_EX);
}

/* ---------------------------------------------------------------
   Input
   --------------------------------------------------------------- */

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 20000) {
    fail(413, 'Request too large.');
}

$in = json_decode($raw, true);
if (!is_array($in)) {
    fail(400, 'Invalid JSON.');
}

/**
 * Consent is not ours to assume. Figure requires these two booleans, and
 * the honest way to supply them is to pass through what the visitor
 * actually ticked. Never default these to true.
 */
if (($in['privacyPolicyOptIn'] ?? false) !== true) {
    fail(400, 'Consent to the privacy policy is required to request offers.');
}

$str = static function ($v, int $max = 120): string {
    return substr(trim((string) $v), 0, $max);
};
$num = static function ($v) {
    return is_numeric($v) ? (float) $v : null;
};
$enum = static function ($v, array $allowed, ?string $default) {
    $v = strtoupper(trim((string) $v));
    return in_array($v, $allowed, true) ? $v : $default;
};

$loanPurposes = [
    'DEBT_CONSOLIDATION', 'HOME_IMPROVEMENT', 'TRAVEL', 'EDUCATION',
    'HEALTH_OR_MEDICAL', 'CARING_FOR_FAMILY', 'RETIREMENT',
    'MAJOR_PURCHASE', 'OTHER',
];
$employment = [
    'EMPLOYED', 'UNEMPLOYED', 'SELF_EMPLOYED', 'MILITARY', 'RETIRED',
];
$creditRatings = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'UNKNOWN_CREDIT'];

/* ---------------------------------------------------------------
   Build Figure's payload
   --------------------------------------------------------------- */

$payload = [
    'affiliateId'        => $affiliateId,
    'requestType'        => 'OFFERS',
    'loanPurpose'        => $enum($in['loanPurpose'] ?? '', $loanPurposes, 'OTHER'),
    'privacyPolicyOptIn' => true,
    'remarketingAllowed' => (($in['remarketingAllowed'] ?? false) === true),
    'source'             => $str($cfg['source'] ?? 'tmfus.com', 60),
];

foreach ([
    'firstName' => 60,
    'lastName'  => 60,
    'email'     => 120,
    'phone'     => 30,
    'leadId'    => 60,
] as $field => $max) {
    if (!empty($in[$field])) {
        $payload[$field] = $str($in[$field], $max);
    }
}

// Property — Figure prices off the home, so this matters most.
$addr = is_array($in['address'] ?? null) ? $in['address'] : [];
if (!empty($addr['street1']) || !empty($addr['zip'])) {
    $payload['address'] = array_filter([
        'street1' => $str($addr['street1'] ?? '', 120),
        'street2' => $str($addr['street2'] ?? '', 60),
        'city'    => $str($addr['city'] ?? '', 60),
        'state'   => strtoupper($str($addr['state'] ?? '', 2)),
        'zip'     => $str($addr['zip'] ?? '', 10),
        'type'    => 'HOME',
    ], static fn($v) => $v !== '');
}

/**
 * Types matter here. The spec declares currentMortgageBalances and
 * amountToBorrow as integers; PHP floats serialise as 250000.0, which the
 * API can reject. Cast them so the JSON matches the schema exactly.
 */
$intFields = ['currentMortgageBalances', 'amountToBorrow'];
$numFields = ['propertyValue', 'monthlyMortgagePayment', 'monthlyExpenses'];

foreach ($intFields as $f) {
    $v = $num($in[$f] ?? null);
    if ($v !== null && $v >= 0) {
        $payload[$f] = (int) round($v);
    }
}
foreach ($numFields as $f) {
    $v = $num($in[$f] ?? null);
    if ($v !== null && $v >= 0) {
        $payload[$f] = $v + 0;
    }
}

// The site asks for MONTHLY income; Figure's householdIncome is annual.
$income = $num($in['householdIncome'] ?? null);
if ($income !== null && $income >= 0) {
    $annualise = ($cfg['income_is_annual'] ?? true) === true;
    $payload['householdIncome'] = $annualise ? $income * 12 : $income;
}

$fico = $num($in['fico'] ?? null);
if ($fico !== null && $fico >= 300 && $fico <= 900) {
    $payload['fico'] = (int) $fico;
}

$rating = $enum($in['selfCreditRating'] ?? '', $creditRatings, null);
if ($rating !== null) {
    $payload['selfCreditRating'] = $rating;
}

$emp = $enum($in['employmentStatus'] ?? '', $employment, null);
if ($emp !== null) {
    $payload['employmentStatus'] = $emp;
}

/* ---------------------------------------------------------------
   Call Figure
   --------------------------------------------------------------- */

$base = (($cfg['environment'] ?? 'test') === 'production')
    ? 'https://api.figure.com'
    : 'https://api.test.figure.com';

$ch = curl_init($base . FIGURE_PATH);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Accept: application/json',
        'User-Agent: TMF-Team-Website/1.0 (+https://tmfus.com)',
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$body   = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err    = curl_error($ch);
curl_close($ch);

if ($body === false) {
    logLine($cfg, 'CURL_FAIL ' . $err);
    fail(502, 'Could not reach Figure. Please try again in a moment.');
}

if ($status < 200 || $status >= 300) {
    // Log the status but not the payload — it contains borrower details.
    logLine($cfg, 'FIGURE_HTTP_' . $status . ' ' . substr((string) $body, 0, 300));
    // Surface the upstream status so a failure can be diagnosed without
    // reading the log file. A status code is not sensitive.
    respond(502, [
        'ok'             => false,
        'error'          => 'Figure could not return offers for these details.',
        'upstreamStatus' => $status,
    ]);
}

$data = json_decode((string) $body, true);
if (!is_array($data)) {
    logLine($cfg, 'FIGURE_BAD_JSON ' . substr((string) $body, 0, 200));
    fail(502, 'Unexpected response from Figure.');
}

/* ---------------------------------------------------------------
   Return only what the page needs
   --------------------------------------------------------------- */

$offers = [];
foreach (($data['offers'] ?? []) as $o) {
    if (!is_array($o)) {
        continue;
    }
    $offers[] = [
        'loanAmount'     => $o['loanAmount'] ?? null,
        'interestRate'   => $o['interestRate'] ?? null,
        'apr'            => $o['apr'] ?? null,
        'term'           => $o['term'] ?? null,
        'rateType'       => $o['rateType'] ?? null,
        'monthlyPayment' => $o['monthlyPayment'] ?? null,
        'originationFee' => $o['originationFee'] ?? null,
    ];
}

respond(200, [
    'ok'              => true,
    'status'          => $data['status'] ?? null,
    'offers'          => $offers,
    'personalizedUrl' => $data['personalizedUrl'] ?? null,
    'disclosure'      => $data['cannedText'] ?? null,
]);
