<?php
/**
 * Figure HELOC API — configuration template
 *
 * Copy this file to  api/config.php  and fill in your values.
 *
 * config.php is listed in .gitignore and must NEVER be committed.
 * The tmfus-clean repository is public — an affiliate ID pushed to it is
 * a leaked credential and has to be rotated with Figure.
 */

return [

    // ---------------------------------------------------------------
    // Your affiliate ID. This 36-character UUID *is* the API key.
    // Supplied by Figure Technologies for production.
    //
    // Figure's published sandbox IDs, for testing only:
    //   self-attested model : d02bc4e9-35af-4c31-970e-e1273079ba41
    //   licensed partners   : e5c722ec-eaf1-4cb1-8fcb-f2c16b31fade
    // ---------------------------------------------------------------
    'affiliate_id' => 'PUT-YOUR-AFFILIATE-ID-HERE',

    // 'test'       -> https://api.test.figure.com
    // 'production' -> https://api.figure.com
    'environment' => 'test',

    // Sent to Figure so they can attribute the traffic.
    'source' => 'tmfus.com',

    // Household income on the site is captured monthly. Figure's
    // householdIncome field is annual, so it is multiplied by 12 before
    // sending. Set to false if Figure tells you they expect monthly.
    'income_is_annual' => true,

    // Requests allowed per IP per hour. A public endpoint costs you API
    // calls, so this stops a bored visitor draining your quota.
    'rate_limit_per_hour' => 20,

    // Written on failures. Never contains the affiliate ID.
    // Keep it outside the web root if your host allows.
    'log_file' => __DIR__ . '/figure-errors.log',

    // ---------------------------------------------------------------
    // BRANDED APPLICATION  (api/application.php)
    // ---------------------------------------------------------------

    // Where bank statements land. Put this OUTSIDE public_html if your
    // host allows it — e.g. '/home/YOURUSER/tmf-applications'. These are
    // customer financial documents; the further from the web root, the
    // better. If left as-is the .htaccess in this repo blocks web access,
    // which is a second line of defence, not the first.
    'application_dir' => __DIR__ . '/uploads',

    // Emailed when an application arrives. The email contains a reference
    // number and the business name only — never the applicant's details.
    // Leave empty to switch notifications off.
    'application_notify' => '',

    // ---------------------------------------------------------------
    // APPLICATION ENCRYPTION KEY  —  REQUIRED
    //
    // Applications carry Social Security numbers, dates of birth and a
    // signature. They are encrypted the moment they arrive, using this
    // PUBLIC key. Without it api/application.php refuses submissions
    // rather than storing that data in the clear — that refusal is
    // deliberate, so do not "fix" it by removing the check.
    //
    // This is the PUBLIC half of the pair. It is safe on the server and
    // safe in a backup: it can lock, it cannot unlock. The PRIVATE half
    // belongs on John's machine and NOWHERE ELSE — not in this file, not
    // in the repo, not in an email. Anyone holding it can read every
    // application ever submitted.
    //
    // Generate the pair in tmf-application-tool.html, then either paste
    // the public key here between the quotes, or save it as a .pem file
    // and put its path here instead. Both forms work.
    // ---------------------------------------------------------------
    'application_pubkey' => '',
];
