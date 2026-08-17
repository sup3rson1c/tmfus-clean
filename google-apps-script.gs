/**
 * TMF Team — lead capture endpoint
 * ---------------------------------------------------------------
 * Receives submissions from tmfus.com and appends them as rows in
 * this spreadsheet. Paste this whole file into Apps Script, deploy
 * as a Web App, and put the resulting URL into assets/app.js.
 *
 * Full instructions: SETUP-LEAD-CAPTURE.md
 */

// Optional: put your email here to be notified on every new lead.
// Leave empty ('') for no emails.
var NOTIFY_EMAIL = '';

// One tab per submission type, so calculator leads and contact
// messages do not fight over columns.
var SHEETS = {
  'funding-calculator': 'Calculator leads',
  'contact': 'Contact messages'
};

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var kind = body.kind || 'unknown';
    var data = body.data || {};

    var sheet = getSheet(SHEETS[kind] || 'Other');

    // Build the header row from whatever keys arrive, growing it if a new
    // field appears later, so nothing is silently dropped.
    var fixed = ['Received', 'Page', 'Referrer'];
    var headers = sheet.getLastRow() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];

    if (headers.length === 0) {
      headers = fixed.concat(Object.keys(data));
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else {
      var added = [];
      Object.keys(data).forEach(function (k) {
        if (headers.indexOf(k) === -1) added.push(k);
      });
      if (added.length) {
        headers = headers.concat(added);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
    }

    var row = headers.map(function (h) {
      if (h === 'Received') return body.submittedAt ? new Date(body.submittedAt) : new Date();
      if (h === 'Page') return body.page || '';
      if (h === 'Referrer') return body.referrer || '';
      return data[h] !== undefined ? data[h] : '';
    });

    sheet.appendRow(row);

    if (NOTIFY_EMAIL) {
      var lines = Object.keys(data).map(function (k) { return k + ': ' + data[k]; });
      MailApp.sendEmail(
        NOTIFY_EMAIL,
        'New ' + kind + ' lead — TMF Team',
        lines.join('\n') + '\n\nPage: ' + (body.page || '')
      );
    }

    return json({ ok: true });
  } catch (err) {
    // Record the failure rather than losing it silently.
    try {
      getSheet('Errors').appendRow([new Date(), String(err), e && e.postData ? e.postData.contents : '']);
    } catch (_) {}
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, message: 'TMF Team lead endpoint is live.' });
}

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
