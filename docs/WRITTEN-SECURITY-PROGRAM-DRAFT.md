# Written Security Program — draft for John

Status: draft only. It is not legal advice and does not prove compliance. John must complete every item marked **[JOHN TO COMPLETE]**, approve this document, and have appropriate counsel or a qualified security professional review it before relying on it.

Last reviewed: **[JOHN TO COMPLETE: date]**
Owner responsible for this program: **[JOHN TO COMPLETE: full name and role]**
Business / trading name: **[JOHN TO COMPLETE]**

## 1. What this program covers

This program covers customer and applicant information handled through the TMF website and its supporting services. That can include contact details, business information, application information, uploaded financial documents, and sensitive personal information when an applicant provides it.

The goal is simple: collect only what is needed, keep it out of public view, let only approved people and services reach it, and act quickly if something goes wrong.

## 2. Who is responsible

The owner named above is responsible for:

- approving this program and reviewing it at least once each year;
- approving who may access customer information;
- keeping the vendor list current;
- making sure access is removed when it is no longer needed;
- deciding whether a security event needs outside reporting; and
- recording decisions, reviews, tests, and fixes.

Backup contact if the owner is unavailable: **[JOHN TO COMPLETE: name and contact method]**.

## 3. Information map

Before launch, John records where each category of information is collected, stored, viewed, transmitted, and deleted.

| Information | Why it is collected | Where it is stored | Who may access it | Retention / deletion rule |
|---|---|---|---|---|
| Contact and business details | Respond to a request or review funding options | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** |
| Application and financial documents | Review an application | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** |
| Sensitive personal information | Only where needed for the application process | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** |
| Opt-out requests | Honor privacy and marketing choices | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** |

Do not put customer information in personal notes, unapproved spreadsheets, chat messages, or public repositories.

## 4. Risk review

At least once each year, and before a major new service or data flow goes live, the owner reviews these questions:

1. What information is handled, and how sensitive is it?
2. Where could it be exposed, lost, changed, or accessed without permission?
3. Which people and vendors can reach it?
4. What existing safeguard reduces each risk?
5. What change is needed, who owns it, and by when?

Record the review here or in an attached log:

| Date | Change or risk reviewed | Decision / fix | Owner | Due date | Completed date |
|---|---|---|---|---|---|
| **[JOHN TO COMPLETE]** | | | | | |

## 5. Safeguards

### Access

- Each person uses their own account. Shared logins are not allowed.
- Access is limited to the smallest amount needed for the work.
- Strong unique passwords are required. Multi-factor authentication is used where the service supports it, especially for hosting, source control, email, storage, and any customer-information system.
- Access is reviewed at least quarterly and removed promptly when a person or vendor no longer needs it.
- Admin access is not used for ordinary work.

### Systems and secrets

- Secrets, API keys, private keys, passwords, and customer data are never committed to GitHub or other source-control repositories.
- Production configuration stays outside the public web directory and outside the repository.
- Supported software, plugins, and dependencies are kept updated after a reasonable review.
- Production backups and recovery steps are recorded and tested: **[JOHN TO COMPLETE: location, frequency, encryption, and test date]**.
- Security logs and error logs are reviewed after a suspected incident and during scheduled reviews.

### Website and data handling

- The public website uses HTTPS.
- Customer files are stored outside the public website folder.
- Sensitive application data is protected in transit and at rest using the site’s approved encryption design.
- Development and local testing use test data and local mocks. They do not submit real customer information to production services.
- New forms, integrations, tracking tools, and vendors need owner approval before launch.

### People

- Anyone with access receives a short briefing on phishing, password safety, customer-data handling, and how to report a suspected incident.
- Training date and attendees: **[JOHN TO COMPLETE]**.
- The owner reviews access immediately when a worker, contractor, or vendor relationship ends.

## 6. Vendor oversight

Before a vendor receives customer information, the owner records what it receives, why it needs it, the account owner, and the agreement or privacy terms reviewed. The vendor list is the working record.

For a new vendor, confirm:

- the service is needed;
- the minimum necessary information is shared;
- the owner has reviewed its security and privacy information;
- access can be removed; and
- the vendor is added to the vendor list before data is shared.

## 7. Monitoring, testing, and review

- Review admin and vendor access at least quarterly.
- Run the website’s pre-launch verification before every production release.
- Test backup recovery at least once a year: **[JOHN TO COMPLETE: next test date]**.
- Review this program at least annually and after a material change or incident.
- Record failed checks, fixes, and the date the fix was confirmed.

## 8. When something looks wrong

Follow `INCIDENT-RESPONSE-PLAN-DRAFT.md`. Do not delete logs, alter records, or promise anyone a result before the facts are known.

## 9. Approval record

Approved by: **[JOHN TO COMPLETE: name]**

Date: **[JOHN TO COMPLETE]**

Next annual review due: **[JOHN TO COMPLETE]**
