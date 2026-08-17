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

const FIGURE_PATH = '/products/heloc/pre-qualify/v2';

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

$map = [
    'propertyValue'           => 'propertyValue',
    'currentMortgageBalances' => 'currentMortgageBalances',
    'monthlyMortgagePayment'  => 'monthlyMortgagePayment',
    'monthlyExpenses'         => 'monthlyExpenses',
    'amountToBorrow'          => 'amountToBorrow',
];
foreach ($map as $from => $to) {
    $v = $num($in[$from] ?? null);
    if ($v !== null && $v >= 0) {
        $payload[$to] = $v;
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
    fail(502, 'Figure could not return offers for these details.');
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
