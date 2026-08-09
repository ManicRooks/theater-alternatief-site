/*
 * Theater Alternatief — Reservation Backend (Google Apps Script)
 *
 * SETUP:
 * 1. Open your Google Sheet (the one with "Totalen" and "Reservaties" tabs)
 * 2. Go to Extensions > Apps Script
 * 3. Replace the default Code.gs content with this file
 * 4. Update CONFIG below (spreadsheet ID, production name, etc.)
 * 5. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the deployment URL
 * 7. Paste it as APPS_SCRIPT_URL in your site's booking.js
 *
 * SHEET STRUCTURE:
 * - "Totalen" tab: Column A = date (native Sheets date, e.g. 2026-10-23),
 *                  Column D = available seats (number). Rows 3-20.
 * - "Reservaties" tab: receives booking rows automatically.
 *   Columns: Code | Timestamp | Name | Email | Date | Seats | Remarks
 *
 * After changing CONFIG, redeploy (Deploy > Manage deployments > Edit > New version).
 */

const CONFIG = {
  SPREADSHEET_ID: '1-cGDxRlnCqjB7nbKOBp0gx-z9VW5RGapyR35hY1vKvA',
  PRODUCTION_NAME: 'De Doemdenker',
  SEND_MAIL: true,
  BOOKINGS_OPENED: true,
  MAILCHIMP_LIST_ID: '6abc460f5d',
  REPLY_TO: 'reservatie@theateralternatief.be',
  BCC: 'reservatie@theateralternatief.be',
  LEAD_TEXT_CLOSED: 'De reservatie opent binnenkort, blijf op de hoogte via onze <a href="#contact">nieuwsbrief of socials</a>.'
};

const STATUS_INACTIVE = 'STATUS_INACTIVE';
const STATUS_SOLDOUT = 'STATUS_SOLDOUT';
const STATUS_LIMITED = 'STATUS_LIMITED';
const STATUS_ACTIVE = 'STATUS_ACTIVE';
const STATUS_CLOSED = 'STATUS_ONLINE_RESERVATION_CLOSED';

function doGet() {
  var data = getPerformanceData();
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var result = processBooking(params);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getPerformanceData() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Totalen');
  var values = sheet.getRange('A3:D20').getValues();

  var performances = {};
  var now = new Date();

  for (var i = 0; i < values.length; i++) {
    var cellDate = values[i][0];
    if (!cellDate || typeof cellDate.getTime !== 'function') continue;

    var available = values[i][3];
    var showTime = new Date(cellDate);
    showTime.setHours(20, 0, 0, 0);
    var key = Utilities.formatDate(cellDate, 'Europe/Brussels', 'yyyy-MM-dd');

    var status;
    if (!CONFIG.BOOKINGS_OPENED || showTime < now) {
      status = STATUS_INACTIVE;
    } else if (available <= 0) {
      status = STATUS_SOLDOUT;
    } else if (showTime.getTime() - now.getTime() < 3 * 60 * 60 * 1000) {
      status = STATUS_CLOSED;
    } else if (available <= 10) {
      status = STATUS_LIMITED;
    } else {
      status = STATUS_ACTIVE;
    }

    performances[key] = status;
  }

  var result = { performances: performances };
  if (!CONFIG.BOOKINGS_OPENED) {
    result.leadtext = CONFIG.LEAD_TEXT_CLOSED;
  }
  return result;
}

function formatDutchDate(isoDate) {
  var d = new Date(isoDate + 'T12:00:00');
  var days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function processBooking(params) {
  var name = (params.name || '').trim();
  var email = (params.email || '').trim();
  var bookingDate = params.bookingDate;
  var seats = parseInt(params.bookingSeats);
  var remarks = (params.remarks || '').trim();
  var newsletter = params.newsletter;

  if (!name || !email || !bookingDate) {
    return { success: false, error: 'Vul alle verplichte velden in.' };
  }

  if (isNaN(seats) || seats < 1 || seats > 10) {
    return { success: false, error: 'Ongeldig aantal plaatsen (1-10).' };
  }

  var data = getPerformanceData();
  var status = data.performances[bookingDate];
  if (!status || status === STATUS_INACTIVE || status === STATUS_SOLDOUT || status === STATUS_CLOSED) {
    return { success: false, error: 'Deze voorstelling is niet beschikbaar voor reservatie.' };
  }

  var id = generateId();

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Reservaties');
  var timestamp = Utilities.formatDate(new Date(), 'Europe/Brussels', 'dd-MM-yyyy HH:mm:ss');
  var bookingDateObj = new Date(bookingDate + 'T12:00:00');
  sheet.appendRow([id, timestamp, name, email, bookingDateObj, seats, remarks]);

  if (CONFIG.SEND_MAIL) {
    sendConfirmationEmail(id, name, email, formatDutchDate(bookingDate), seats, remarks);
  }

  if (newsletter) {
    subscribeNewsletter(email, name);
  }

  return {
    success: true,
    id: id,
    name: name,
    email: email,
    bookingDate: bookingDate,
    bookingSeats: seats,
    remarks: remarks
  };
}

function generateId() {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Reservaties');
  var existingIds = sheet.getDataRange().getValues().map(function(row) { return row[0]; });

  var id;
  do {
    id = '';
    for (var i = 0; i < 5; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existingIds.indexOf(id) !== -1);

  return id;
}

function sendConfirmationEmail(id, name, email, bookingDate, seats, remarks) {
  var body = '<h1>Bedankt voor uw reservatie.</h1>'
    + '<p>Overzicht van uw reservatie:</p>'
    + '<ul>'
    + '<li>Code: ' + id + '</li>'
    + '<li>Naam: ' + name + '</li>'
    + '<li>E-mail: ' + email + '</li>'
    + '<li>Voorstelling: ' + bookingDate + '</li>'
    + '<li>Aantal plaatsen: ' + seats + '</li>'
    + '<li>Opmerkingen: ' + (remarks || '-') + '</li>'
    + '</ul>'
    + '<p>Er is geen verdere actie vereist, u wordt verwacht vanaf 19u.</p>'
    + '<p>De toegangsprijs bedraagt 12 Euro per plaats, u kan bij aankomst betalen met cash of QR code.</p>'
    + '<p>Wenst u uw reservatie te wijzigen? Contacteer ons op '
    + '<a href="mailto:reservatie@theateralternatief.be">reservatie@theateralternatief.be</a>.</p>'
    + '<br>Met vriendelijke groeten,<br>Theater Alternatief';

  GmailApp.sendEmail(email, 'Theater Alternatief reservatie', '', {
    htmlBody: body,
    replyTo: CONFIG.REPLY_TO,
    bcc: CONFIG.BCC,
    name: 'Theater Alternatief'
  });
}

function subscribeNewsletter(email, name) {
  var parts = name.split(' ');
  var firstName = parts[0] || '';
  var lastName = parts.slice(1).join(' ') || '';

  var url = 'https://us12.api.mailchimp.com/3.0/lists/' + CONFIG.MAILCHIMP_LIST_ID + '/members/';
  var payload = {
    email_address: email,
    status: 'subscribed',
    merge_fields: { FNAME: firstName, LNAME: lastName }
  };

  try {
    UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode('username:' + PropertiesService.getScriptProperties().getProperty('MAILCHIMP_API_KEY'))
      },
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('MailChimp subscription failed: ' + e.message);
  }
}

/**
 * Run this once from the Apps Script editor to store the MailChimp API key.
 * Select this function in the dropdown and click Run.
 */
function setupSecrets() {
  PropertiesService.getScriptProperties().setProperty('MAILCHIMP_API_KEY', 'YOUR_KEY_HERE');
  Logger.log('MailChimp API key stored.');
}
