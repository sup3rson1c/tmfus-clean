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

    // ---------------------------------------------------------------
    // APPLICATION INBOX  (admin.php)
    //
    // The password for https://tmfus.com/admin.php, where you read
    // applications without going through cPanel. Without it that page
    // refuses to open at all.
    //
    // Make it LONG — four or five unrelated words beats a short scramble.
    // Anyone with this password can see applicant names, emails, phone
    // numbers and bank statements. They still cannot see Social Security
    // numbers, dates of birth or signatures: those stay encrypted, and
    // the key that opens them is not on this server.
    // ---------------------------------------------------------------
    'admin_password' => '',

    // Optional. If you would rather not keep the password in plain text,
    // put a password_hash() output here instead and leave the line above
    // empty. This one wins if both are set.
    'admin_password_hash' => '',

    // ---------------------------------------------------------------
    // LIVE CHAT  (api/chat.php, widget on every page, takeover in admin)
    //
    // The visitor's browser never sees any of this. It talks only to
    // api/chat.php, which talks to your agent. Put nothing here in the
    // site's JavaScript, ever — page scripts are public.
    // ---------------------------------------------------------------
    'chat_enabled' => false,

    // Your Hermes agent's URL, and the key it expects.
    'chat_endpoint' => '',
    'chat_api_key'  => '',

    // 'openai' — POST {model, messages:[{role,content}]}, reply read from
    //            choices[0].message.content. What most hosted model APIs speak.
    // 'simple' — POST {session, message, history, system}, reply read from
    //            `reply`. For a custom agent service of your own.
    'chat_format' => 'openai',
    'chat_model'  => '',

    // How the key is sent. Defaults suit almost everything; change only
    // if your provider documents something different.
    'chat_auth_header' => 'Authorization',
    'chat_auth_prefix' => 'Bearer ',

    'chat_max_tokens'  => 500,
    'chat_temperature' => 0.4,

    // Leave empty to use the built-in one, which already tells the agent
    // never to quote rates, never to claim an approval, and never to ask
    // for an SSN. Read DEFAULT_SYSTEM_PROMPT in api/chat.php before you
    // replace it — those rules are there for a reason.
    'chat_system_prompt' => '',

    // Emailed when a visitor asks to speak to a person. Falls back to
    // application_notify if left empty.
    'chat_notify' => '',
];
