# Data retention options — decision draft

Status: draft for John and a qualified privacy/compliance reviewer. It is not legal advice and it does not change the public privacy policy yet.

## Why this exists

TMF holds applications, business bank statements, enquiries, chat transcripts and opt-out records. Keeping information forever creates avoidable risk; deleting it too early can break record-keeping duties or a consumer request. The current privacy policy remains accurate but deliberately broad until John picks a policy and a reviewer confirms it.

## Recommended starting policy

| Information | Suggested period | When the clock starts | What happens at the end |
|---|---:|---|---|
| Funded application and supporting documents | 7 years | funding closes or the last required record date, whichever is later | Review before deletion; do not automate until the funding-status source is defined. |
| Inactive application that never funded | 24 months | last activity | Review before deletion; the website currently does not store a reliable funded/not-funded status. |
| Calculator and contact enquiry | 24 months | received date | Eligible for a supervised purge after a dry-run review. |
| Chat transcript | 90 days | last update | Eligible for a supervised purge after a dry-run review, unless it is tied to an active application or complaint. |
| Marketing opt-out / suppression record | Do not auto-delete | — | Keep it while marketing might resume; removing it can cause a new unwanted contact. |
| Security and access logs | 12 months | log date | Decide separately with the host and any incident-response requirements. |

These periods are proposed operational defaults, not a statement of legal retention requirements. A funding agreement, dispute, audit, litigation hold, consumer request, or applicable law can require a longer hold. Those records are excluded from every purge until TMF has a documented hold process.

## What John must decide before deletion is ever enabled

1. Confirm or replace every period above with a qualified reviewer.
2. Define where a funded/not-funded result and the last activity date live. The site does not currently have reliable fields for either one, so application folders are deliberately never auto-deleted.
3. Decide who can approve a purge and how they record a litigation hold, complaint, audit, or consumer-request exception.
4. Update the privacy policy with the approved periods before treating this as the public retention policy.
5. Run the dry-run, inspect its category-and-month totals, and save the output with the approval record. Only then may an authorized operator use the script's explicit `--apply` flag.

## Dry-run tool

`php tools/retention-purge.php --dry-run` reads the configured protected application store and reports only category/month totals. It does not print names, email addresses, phone numbers, file paths, or file contents. It does not call any external service and does not write anything.

The proposed dry-run candidates are enquiries older than 24 months and chat transcripts older than 90 days. Applications and opt-outs are reported as excluded, not selected.

`--apply` is intentionally guarded by `--confirm=PURGE-RETENTION`. It is not for routine use and must not be run until the decisions above are completed. It removes only the candidate enquiry and chat files the dry-run would have selected; it does not touch applications or opt-outs.
