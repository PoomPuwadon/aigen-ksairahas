/**
 * Bulk roster importer: bind this script to a Google Sheet and it will push
 * the "Edit พี่รหัส" (bigbros) and "Edit น้องรหัส" (lilbros) tabs into the
 * Supabase `users` table whenever the checkbox in cell A5 of either sheet is
 * checked. Each sync fully replaces that usertype's rows (delete-then-insert)
 * — this is a roster mirror, not an incremental sync.
 *
 * SETUP
 * 1. Create a Google Sheet with two tabs named exactly "Edit พี่รหัส" and
 *    "Edit น้องรหัส" (see template-bigbro.csv / template-lilbro.csv for the
 *    expected column layout — data starts at row 7, rows 1-6 are yours to
 *    use for a title/checkbox/status area).
 * 2. Put a checkbox in cell A5 of each tab.
 * 3. Extensions -> Apps Script, paste this file in, save.
 * 4. Project Settings -> Script Properties, add:
 *      SUPABASE_URL          = https://your-project-ref.supabase.co
 *      SUPABASE_SERVICE_KEY  = your service_role key (Settings -> API)
 * 5. Triggers -> Add Trigger -> handleEdit -> From spreadsheet -> On edit.
 *
 * SECURITY WARNING: SUPABASE_SERVICE_KEY is the service_role key, NOT the
 * anon key used by the frontend. It bypasses Row Level Security entirely and
 * has full read/write access to every table. It lives only in Script
 * Properties (server-side, never visible in the sheet or in git) — never
 * paste it into a cell, into this file, or into the frontend project.
 */

function handleEdit(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();

  // Only work on these two sheets
  if (
    sheet.getName() !== 'Edit พี่รหัส' &&
    sheet.getName() !== 'Edit น้องรหัส'
  ) {
    return;
  }

  // Only react to A5
  if (e.range.getA1Notation() !== 'A5') return;

  // Only run when checkbox is checked
  if (e.value !== 'TRUE') return;

  try {
    if (sheet.getName() === 'Edit พี่รหัส') {
      syncBigBrosToSupabase(sheet);
    } else {
      syncLilBrosToSupabase(sheet);
    }

    // Update information
    sheet.getRange('D3').setValue(new Date());
    sheet.getRange('D4').setValue(
      Session.getActiveUser().getEmail() || 'unknown'
    );

  } catch (err) {
    SpreadsheetApp.getUi().alert(
      'Sync failed: ' + err.message
    );

  } finally {
    // Reset checkbox
    sheet.getRange('A5').setValue(false);
  }
}


/*
 * ============================================================
 * BIG BRO SYNC
 * Sheet: Edit พี่รหัส
 *
 * A = first_name
 * B = branch
 * C = nickname
 * D = hint1
 * E = hint2
 * F = hint3
 *
 * usertype = 0
 * ============================================================
 */

function syncBigBrosToSupabase(sheet) {
  var props = PropertiesService.getScriptProperties();

  var SUPABASE_URL = props.getProperty('SUPABASE_URL');
  var SERVICE_KEY = props.getProperty('SUPABASE_SERVICE_KEY');

  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_KEY is missing from Script Properties.'
    );
  }

  var lastRow = sheet.getLastRow();
  var rows = [];

  // Data starts at row 7
  if (lastRow >= 7) {

    // Read A:F
    var values = sheet
      .getRange(7, 1, lastRow - 6, 6)
      .getValues();

    values.forEach(function(row) {

      var firstName = String(row[0]).trim(); // A
      var branch = String(row[1]).trim();    // B
      var nickname = String(row[2]).trim();  // C

      // Ignore completely empty rows
      if (!firstName && !branch && !nickname) {
        return;
      }

      // Nickname is required
      if (!nickname) {
        throw new Error(
          'BigBro row has no nickname: row ' +
          (values.indexOf(row) + 7)
        );
      }

      rows.push({
        first_name: firstName,
        branch: branch,
        nickname: nickname,
        usertype: 0,
        hint1: String(row[3] || ''), // D
        hint2: String(row[4] || ''), // E
        hint3: String(row[5] || '')  // F
      });
    });
  }

  var headers = {
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY
  };


  // ----------------------------------------------------------
  // Delete all existing Big Bros
  // ----------------------------------------------------------

  var delResp = UrlFetchApp.fetch(
    SUPABASE_URL + '/rest/v1/users?usertype=eq.0',
    {
      method: 'delete',
      headers: headers,
      muteHttpExceptions: true
    }
  );

  if (delResp.getResponseCode() >= 300) {
    throw new Error(
      'BigBro delete failed: ' +
      delResp.getContentText()
    );
  }


  // ----------------------------------------------------------
  // Insert Big Bros from Google Sheets
  // ----------------------------------------------------------

  if (rows.length > 0) {

    var insResp = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/users',
      {
        method: 'post',

        headers: Object.assign(
          {
            Prefer: 'return=minimal'
          },
          headers
        ),

        contentType: 'application/json',

        payload: JSON.stringify(rows),

        muteHttpExceptions: true
      }
    );

    if (insResp.getResponseCode() >= 300) {
      throw new Error(
        'BigBro insert failed: ' +
        insResp.getContentText()
      );
    }
  }
}


/*
 * ============================================================
 * LIL BRO SYNC
 * Sheet: Edit น้องรหัส
 *
 * A = first_name
 * B = nickname
 * C = branch
 * D = linked_id
 *
 * usertype = 1
 * ============================================================
 */

function syncLilBrosToSupabase(sheet) {
  var props = PropertiesService.getScriptProperties();

  var SUPABASE_URL = props.getProperty('SUPABASE_URL');
  var SERVICE_KEY = props.getProperty('SUPABASE_SERVICE_KEY');

  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_KEY is missing from Script Properties.'
    );
  }

  var lastRow = sheet.getLastRow();
  var rows = [];

  // Data starts at row 7
  if (lastRow >= 7) {

    // Read A:D
    var values = sheet
      .getRange(7, 1, lastRow - 6, 4)
      .getValues();

    values.forEach(function(row) {

      var firstName = String(row[0]).trim(); // A
      var nickname = String(row[1]).trim();  // B
      var branch = String(row[2]).trim();    // C
      var linkedId = String(row[3]).trim();  // D

      // Ignore completely empty rows
      if (!firstName && !nickname && !branch && !linkedId) {
        return;
      }

      // Nickname is required
      if (!nickname) {
        throw new Error(
          'LilBro row has no nickname: row ' +
          (values.indexOf(row) + 7)
        );
      }

      rows.push({
        first_name: firstName,
        nickname: nickname,
        branch: branch,
        linked_id: linkedId || null,
        usertype: 1
      });
    });
  }

  var headers = {
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY
  };


  // ----------------------------------------------------------
  // Delete all existing Lil Bros
  // ----------------------------------------------------------

  var delResp = UrlFetchApp.fetch(
    SUPABASE_URL + '/rest/v1/users?usertype=eq.1',
    {
      method: 'delete',
      headers: headers,
      muteHttpExceptions: true
    }
  );

  if (delResp.getResponseCode() >= 300) {
    throw new Error(
      'LilBro delete failed: ' +
      delResp.getContentText()
    );
  }


  // ----------------------------------------------------------
  // Insert Lil Bros from Google Sheets
  // ----------------------------------------------------------

  if (rows.length > 0) {

    var insResp = UrlFetchApp.fetch(
      SUPABASE_URL + '/rest/v1/users',
      {
        method: 'post',

        headers: Object.assign(
          {
            Prefer: 'return=minimal'
          },
          headers
        ),

        contentType: 'application/json',

        payload: JSON.stringify(rows),

        muteHttpExceptions: true
      }
    );

    if (insResp.getResponseCode() >= 300) {
      throw new Error(
        'LilBro insert failed: ' +
        insResp.getContentText()
      );
    }
  }
}
