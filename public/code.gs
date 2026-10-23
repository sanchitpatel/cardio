function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // ACTION 1: TELEGRAM CLICKED "MARK AS DONE"
    if (data.action === "mark_done") {
      var lastRow = sheet.getLastRow();
      var targetMsgId = String(data.telegram_message_id || "");
      var targetPhone = String(data.phone || "").replace(/\D/g, "");

      for (var r = 2; r <= lastRow; r++) {
        var rowMsgId = String(sheet.getRange(r, 7).getValue());
        var rowPhone = String(sheet.getRange(r, 5).getValue()).replace(/\D/g, "");

        if ((targetMsgId && rowMsgId === targetMsgId) || (targetPhone && rowPhone.indexOf(targetPhone) !== -1)) {
          sheet.getRange(r, 1).setValue(true); // Check Status Checkbox in Column A
          break;
        }
      }
      return ContentService.createTextOutput("OK");
    }

    // ACTION 2: NEW FORM SUBMISSION
    var timestamp = new Date();
    var msgId = data.telegram_message_id || "";

    // Append row: [Checkbox (FALSE), Timestamp, Name, Email, Phone, Message, TelegramMsgId]
    sheet.appendRow([false, timestamp, data.name, data.email, data.phone, data.message, msgId]);

    var newRow = sheet.getLastRow();
    sheet.getRange(newRow, 1).insertCheckboxes();

    return ContentService.createTextOutput("SUCCESS");
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.toString());
  }
}

// ACTION 3: MANUAL SHEET CHECKBOX CLICK ➔ UPDATE TELEGRAM KEEPING ALL LEAD DETAILS
function handleSheetEdit(e) {
  try {
    var range = e.range;
    var sheet = range.getSheet();

    if (range.getColumn() === 1 && range.getValue() === true) {
      var row = range.getRow();
      if (row < 2) return;

      var name = sheet.getRange(row, 3).getValue();
      var email = sheet.getRange(row, 4).getValue();
      var phone = sheet.getRange(row, 5).getValue();
      var message = sheet.getRange(row, 6).getValue();
      var messageId = sheet.getRange(row, 7).getValue();

      if (messageId) {
        UrlFetchApp.fetch("https://amritaara-cms.sanchitpatel1590.workers.dev/api/mark-done-sheet", {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({
            telegram_message_id: messageId,
            name: name,
            email: email,
            phone: phone,
            message: message
          })
        });
      }
    }
  } catch (err) {
    Logger.log("Trigger Error: " + err);
  }
}
