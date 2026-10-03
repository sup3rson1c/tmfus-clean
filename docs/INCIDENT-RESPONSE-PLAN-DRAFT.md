# Incident Response Plan — draft for John

Status: draft only. It is not legal advice. John must complete every item marked **[JOHN TO COMPLETE]**, approve this plan, and obtain appropriate legal or security advice before relying on it.

Plan owner: **[JOHN TO COMPLETE: full name and role]**
Backup decision-maker: **[JOHN TO COMPLETE: name and contact method]**
Last reviewed: **[JOHN TO COMPLETE: date]**

## 1. What counts as an incident

Treat any of these as a possible incident until checked:

- a lost device or account that can reach customer information;
- an unexpected login, password-reset notice, or multi-factor prompt;
- a suspected phishing message or exposed password, key, or private file;
- customer information sent to the wrong person or made public;
- malware, ransomware, website defacement, or unusual site behavior;
- an unavailable backup, deleted files, or unexplained data changes; or
- a vendor saying its service may have been breached.

## 2. First rule: contain, do not guess

1. Write down the time, who noticed the problem, and what was seen.
2. Preserve the evidence. Keep relevant messages, screenshots, and logs. Do not delete, overwrite, or edit them.
3. Stop the immediate exposure if it is safe to do so. Examples: remove a public link, disable the affected account, revoke a key, or take a form offline.
4. Do not reboot, wipe, or restore a system before the owner decides what evidence must be preserved.
5. Do not tell customers, vendors, regulators, or the public that a breach occurred until the owner has reviewed the facts with appropriate advice.

## 3. Roles and contacts

| Role | Person / organization | Contact method | Responsibility |
|---|---|---|---|
| Incident owner | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Makes decisions, keeps the incident record, approves outside notices |
| Technical support | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Secures hosting, accounts, devices, backups, and logs |
| Legal / privacy adviser | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Advises on notice, reporting, preservation, and obligations |
| Insurance contact | **[JOHN TO COMPLETE]** | **[JOHN TO COMPLETE]** | Handles cyber-insurance notice if applicable |
| Vendor contacts | See vendor list | See vendor list | Helps investigate services it operates |

Keep this table current. Do not place passwords, recovery codes, or API keys in this plan.

## 4. Response steps

### A. Triage — as soon as possible

Record:

- when the issue was noticed and by whom;
- what system, account, vendor, or file may be involved;
- what information may be involved;
- whether the exposure is still happening;
- which actions were already taken; and
- who has been told internally.

Give the event a simple status: `possible`, `contained`, `investigating`, `not a breach`, `breach confirmed`, or `closed`.

### B. Contain

Use the smallest safe action that stops further exposure. Depending on the event, this may mean changing a password, revoking a token, disabling an account, removing a file from public access, pausing a form, or asking a vendor to suspend access.

Record every containment action, the person who took it, and the time. Do not make changes that destroy useful evidence unless leaving it unchanged would cause more harm.

### C. Investigate

The owner and technical support determine:

- what happened and when;
- which accounts, devices, systems, or vendors were involved;
- whether information was accessed, acquired, changed, lost, or merely exposed;
- what categories and approximate number of people may be affected;
- whether the incident is ongoing; and
- what records support those conclusions.

If the incident may involve sensitive personal information, seek legal and security advice before deciding notification duties.

### D. Notify and cooperate

The owner decides, with appropriate advice, whether notice is needed to affected people, regulators, law enforcement, insurers, banks, or vendors. Notice timing and wording depend on the facts and applicable law; this plan does not set a universal deadline.

Before sending any notice, record:

- who must be notified and why;
- the reviewing adviser;
- the proposed wording;
- the sending method and date; and
- any required regulator or insurer reference number.

### E. Recover

Restore safe operation only after the owner confirms that the immediate cause has been addressed. This may include resetting credentials, applying an update, restoring from a verified backup, changing an integration setting, or adding monitoring.

Test the affected function with safe test data before returning it to normal use.

### F. Learn and close

Within **[JOHN TO COMPLETE: number]** days after recovery, document:

- root cause or best-supported explanation;
- information and systems affected;
- containment and recovery actions;
- notifications made or why none were required;
- changes that will prevent recurrence; and
- the date the owner approved closure.

Update the Written Security Program, vendor list, access list, and training material when the incident shows a gap.

## 5. Incident record template

| Field | Record |
|---|---|
| Incident number | **[JOHN TO COMPLETE]** |
| Reported date and time | |
| Reporter | |
| Status | |
| Systems / vendors involved | |
| Information possibly involved | |
| Containment actions and times | |
| Evidence retained | |
| Investigation findings | |
| Advisers consulted | |
| Notices made or decision not to notify | |
| Recovery actions and validation | |
| Follow-up owner and due date | |
| Closure approved by / date | |

## 6. Exercises and review

Test this plan at least once each year using a tabletop scenario, such as a lost administrator account or a file accidentally made public. Record the date, participants, what did not work, and the fixes.

Next exercise due: **[JOHN TO COMPLETE]**.
