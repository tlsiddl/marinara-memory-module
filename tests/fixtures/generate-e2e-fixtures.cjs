'use strict';
// Entirely fictional SillyTavern exports, generated deterministically for the isolated E2Es.
const fs = require('node:fs');
const path = require('node:path');

for (const count of [66, 330]) {
  const rows = [{ user_name: '서아', character_name: '하루', create_date: '2025-01-01T00:00:00.000Z', chat_metadata: {} }];
  for (let i = 1; i <= count; i++) {
    // The scene E2E expects #54 to be a user turn; the ledger E2E starts with a user and ends with an assistant turn.
    const user = count === 66 ? i % 2 === 0 : i % 2 === 1;
    const detail = i % 24 === 1 ? '내일 강변 정자에 함께 가기로 약속했다.'
      : i % 24 === 9 ? '서아가 약속이 지켜지지 않아 서운하다고 말했다.'
      : i % 24 === 17 ? '하루가 사과했고 두 사람은 다음 만남을 준비했다.'
      : '두 사람은 서재에서 오래된 지도와 계절 이야기를 나누었다.';
    const narrated = count === 66 && (i === 38 || i === 44);
    const narration = narrated ? `${i}번째 대화에서 두 사람은 조용한 서재에 앉아 창밖으로 내리는 빗소리를 오래 들었다.` : `${i}번째 가상 대화.`;
    const mes = narrated ? narration : `${narration} ${detail} ${user ? '서아' : '하루'}는 그날의 일을 천천히 떠올렸다.`;
    rows.push({ name: user ? '서아' : '하루', is_user: user, mes, send_date: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString() });
  }
  fs.writeFileSync(path.join(__dirname, `synthetic-${count}.jsonl`), rows.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');
}
