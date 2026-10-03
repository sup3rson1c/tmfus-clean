# Vendor Access List — draft for John

Status: draft working record. This is not legal advice. Complete every **[JOHN TO COMPLETE]** field before a vendor receives customer information, and review the list at least quarterly.

Record owner: **[JOHN TO COMPLETE: full name and role]**
Last reviewed: **[JOHN TO COMPLETE: date]**
Next review due: **[JOHN TO COMPLETE: date]**

## How to use this list

A vendor is any outside company or service that can store, process, transmit, back up, receive, or administer customer information. Add a row before sharing data or granting access. Do not record passwords, recovery codes, API keys, private keys, or customer information here.

For each vendor, record the minimum data it receives, the business reason, who owns the account, which people have access, and how access will be removed. If a service is optional or not enabled, keep it marked `not enabled` and do not treat it as approved for data.

## Known site and operating services to confirm

| Vendor / service | Purpose | Customer information it may handle | State | Account owner | Approved users / access level | Terms or privacy review date | Offboarding / access removal | John must confirm |
|---|---|---|---|---|---|---|---|---|
| Website hosting and cPanel provider | Hosts the website and its server-side files | Application files, opt-out records, site logs, and configuration metadata, depending on setup | **[JOHN TO COMPLETE: provider and status]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Remove accounts, rotate credentials, retain or securely delete files per policy | Provider name, data location, backup arrangement |
| GitHub | Stores source code and deployment history | Must not receive customer information or production secrets | In use for source code | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Remove collaborators and deploy credentials | Confirm repository access list and that no customer data or secrets are present |
| Figure | Provides HELOC offer integration when configured | Calculator inputs and offer-related information, if the integration is enabled | **[JOHN TO COMPLETE: enabled / not enabled]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Revoke integration credentials and confirm data-handling steps with Figure | Whether production integration is enabled and what data is sent |
| Google Apps Script / Google Sheets | Lead capture only if this integration is enabled | Contact and calculator lead details sent by the configured flow | **[JOHN TO COMPLETE: enabled / not enabled]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Remove script access, revoke deployment, handle retained records | Whether it is enabled, the account owner, and retention rule |
| Email provider | Receives notices for applications or opt-out requests if configured | Notice metadata and possibly contents, depending on configuration | **[JOHN TO COMPLETE: provider and status]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Remove mailbox access and forwarding rules | Provider, recipients, and minimum data sent in notices |
| Chat AI provider | Answers website chat only if chat is enabled | Visitor messages and approved knowledge content | **[JOHN TO COMPLETE: provider and status]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Disable chat, revoke key, remove account access | Whether chat is enabled and whether customer information can be entered |
| Telegram or other alert provider | Sends internal alerts only if configured | Alert metadata; do not include sensitive customer information | **[JOHN TO COMPLETE: provider and status]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Revoke bot or alert credentials and remove recipients | Whether alerts are enabled and what alert content is allowed |
| Analytics or advertising provider | Measures traffic or advertising only if enabled with consent | Cookie and usage data allowed by the visitor’s consent settings | **[JOHN TO COMPLETE: provider and status]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Disable tags, remove access, update notices if needed | Which tags are enabled and confirmation that consent controls are working |

## Vendors to add if used

Add any payment, CRM, document-signing, file-storage, accounting, IT-support, insurance, lender, broker, marketing, or verification service that can reach customer information.

| Vendor / service | Purpose | Customer information it may handle | State | Account owner | Approved users / access level | Terms or privacy review date | Offboarding / access removal | John must confirm |
|---|---|---|---|---|---|---|---|---|
| **[JOHN TO COMPLETE]** | | | | | | | | |
| **[JOHN TO COMPLETE]** | | | | | | | | |
| **[JOHN TO COMPLETE]** | | | | | | | | |

## Quarterly review record

| Review date | Reviewer | Changes found | Access removed | Follow-up owner and due date |
|---|---|---|---|---|
| **[JOHN TO COMPLETE]** | | | | |
