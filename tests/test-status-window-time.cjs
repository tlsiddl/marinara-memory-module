// A status window whose time is not on the date line: daily life still gets the in-story time.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');

const time = (content, clock) => L.storyTime([{ content, ...(clock ? { clock } : {}) }]);

test('the time is read anywhere in the same status window', () => {
  assert.equal(time('📅 2024년 10월 18일 (금) | 🕐 오후 3:20\n본문입니다.'), '2024-10-18T15:20');
  assert.equal(time('📅 2024년 10월 18일 (금)\n🕐 오후 3:20\n본문입니다.'), '2024-10-18T15:20');
  assert.equal(time('📅 2024년 10월 18일 (금)\n📍 카페 2층\n☁️ 흐림\n\n⏰ 15:20\n\n그녀가 커피를 마셨다.'), '2024-10-18T15:20');
  assert.equal(time('[ 상태 ]\n시간: 21:05\n날짜: 2024-10-18 금요일\n위치: 집\n본문입니다.'), '2024-10-18T21:05');
});

test('a labelled time wins; ranges, durations, prose and two bare times are not guessed', () => {
  assert.equal(time('2024.10.18 (금)\n영업시간 09:00~18:00\n현재 시각 14:10\n본문입니다.'), '2024-10-18T14:10');
  assert.equal(time('2024.10.18 (금)\n영업 9시-18시\n본문입니다.'), null);
  assert.equal(time('2024.10.18 (금)\n남은 시간 3시간\n본문입니다.'), null);
  assert.equal(time('2024.10.18 (금)\n그는 오후 3시에 만나자고 했다.'), null);
  assert.equal(time('2024.10.18 (금)\n14:10\n18:30\n본문입니다.'), null);
  assert.equal(time('2024.10.18 (금)\n본문입니다.'), null);
});

test('a compact [YYYYMMDD|HH:MM] header is read even when prose follows on the same line', () => {
  assert.equal(time('[20201018|19:25]\n본문입니다.'), '2020-10-18T19:25');
  assert.equal(time('[20201018|19:25] 그녀가 문을 열었다.'), '2020-10-18T19:25');
  assert.equal(time('앞 문장. [20201018|19:25|카페] 그녀가 문을 열었다.'), '2020-10-18T19:25');
  assert.equal(time('【20201018 | 오후 7시 25분】 그녀가 웃었다.'), '2020-10-18T19:25');
});

test('a [RP|date|time|place|weather] header is read field by field, whatever the place and weather say', () => {
  assert.equal(time('[RP|20201018|19:35|서아의 집 거실|맑음]\n[👔|니트]\n[👔|셔츠]\n\n그녀가 문을 열었다.'), '2020-10-18T19:35');
  assert.equal(time('[RP|20201018|19:35|"블루문" 바|비]\n본문.'), '2020-10-18T19:35');
  assert.equal(time('[RP|20201018|19:35|Blue Moon bar on the corner of the old street downtown|light rain and cold wind]\n본문.'), '2020-10-18T19:35');
  assert.equal(time('[RP|2020년 10월 18일 (일)|오후 7시 35분|집|맑음] 그녀가 웃었다.'), '2020-10-18T19:35');
  assert.equal(time('[👔|니트]\n[3|5]\n[HP|100/100]\n본문.'), null);
});

test('a status window in a <details> toggle is read, also when inline tags put every field on one line', () => {
  const read = (content) => L.storyTime(L.prepareMessages([{ id: 'a', number: 1, speaker: '하루', role: 'assistant', content }]));
  assert.equal(read('<details><summary>상태창</summary><div>[RP|20201018|19:35|집|맑음]</div><div>[👔|니트]</div><div>[📝|아주 긴 기타 내용입니다. "대사"도 있음.]</div></details>\n\n그녀가 문을 열었다.'), '2020-10-18T19:35');
  assert.equal(read('<details><summary>상태</summary>날짜: 2020-10-18 일요일<br>시간: 19:35<br>의상: 니트<br>기타: 길고 긴 내용.</details>\n본문.'), '2020-10-18T19:35');
  assert.equal(read('<details><summary>📋</summary><span>📅 2020.10.18 (일)</span> <span>🕐 19:35</span> <span>👔 니트</span> <span>📝 아주 긴 기타 내용입니다.</span></details>\n그녀가 문을 열었다.'), '2020-10-18T19:35');
  assert.equal(read('<span>📅 2020년 10월 18일</span> <span>⏰ 오후 7:35</span> <span>📍 카페</span> <span>📝 긴 내용.</span>\n본문.'), '2020-10-18T19:35');
  assert.equal(read('그녀는 웃었다 😊 그리고 2020년 10월 18일을 떠올렸다 🙂 그날 7시였다.'), null);
});

test('a date line without a time takes the tracker time of the same day only', () => {
  assert.equal(time('2024.10.18 (금)\n본문입니다.', { date: '2024-10-18', time: '08:00' }), '2024-10-18T08:00');
  assert.equal(time('2024.10.18 (금)\n본문입니다.', { date: '2024-10-17', time: '08:00' }), null);
});
