// 공룡 일기장을 구글 시트에 모으는 Apps Script. 시트 메뉴 [확장 프로그램 → Apps Script]에 통째로 붙여 넣고
// [배포 → 새 배포 → 웹 앱, 실행: 나, 액세스: 모든 사용자]로 배포한 뒤 나온 주소를 src/config.js 의 DIARY_URL 에 넣는다
var COLS = [
  ['date', '날짜'],
  ['stage', '무대'],
  ['weather', '날씨'],
  ['a', '동물1'],
  ['b', '동물2'],
  ['winner', '이긴 동물'],
  ['ko', 'K.O.'],
  ['reason', '이긴 까닭'],
  ['aId', 'id1'],
  ['bId', 'id2'],
  ['wId', '이긴 id']
];

function doPost(e) {
  var p = JSON.parse(e.postData.contents);
  var s = SpreadsheetApp.getActive().getSheets()[0];
  if (s.getLastRow() === 0) {
    s.appendRow(COLS.map(function (c) { return c[1]; }));
  }
  var row = COLS.map(function (c) {
    var v = p[c[0]] == null ? '' : String(p[c[0]]).slice(0, 300);
    return /^[=+\-@]/.test(v) ? "'" + v : v; // 수식으로 읽히지 않게
  });
  s.appendRow(row);
  return ContentService.createTextOutput('ok');
}

function doGet() {
  var s = SpreadsheetApp.getActive().getSheets()[0];
  var rows = s.getDataRange().getValues().slice(1).slice(-300);
  var list = rows.map(function (r) {
    var o = {};
    COLS.forEach(function (c, i) {
      o[c[0]] = r[i] instanceof Date ? r[i].toISOString() : r[i];
    });
    return o;
  });
  return ContentService.createTextOutput(JSON.stringify(list))
    .setMimeType(ContentService.MimeType.JSON);
}
