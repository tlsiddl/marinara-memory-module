'use strict';
// Shared cases for tests/test-simulator-mode.cjs. The character-mode prompts built from these on main (a26b545,
// before simulator mode existed) are saved in simulator-character-snapshot.json: character mode must not change.
const L = require('../../memory-module/lib/ledger.cjs');
const S = require('../../memory-module/lib/scenes.cjs');

const NARRATOR = 'Hogwarts Simulator';
const USER = '이리나';

/** A narrator card voicing three students, the user's character among them. */
function slice() {
  return L.prepareMessages([
    { id: 'm1', number: 1, role: 'assistant', speaker: NARRATOR, content: '대연회장에 촛불이 떠 있다. 헤르미온느 그레인저가 책을 덮고 고개를 든다. "또 늦었네, 론." 론 위즐리가 의자에 털썩 앉는다. "배고파 죽겠어."' },
    { id: 'm2', number: 2, role: 'user', speaker: USER, content: '나는 헤르미온느 옆에 앉으며 물었다. "오늘 수업 뭐였어?"' },
    { id: 'm3', number: 3, role: 'assistant', speaker: NARRATOR, content: '헤르미온느가 목소리를 낮춘다. "변신술이었어. 그런데 이건 비밀인데, 네빌이 시험지를 잃어버렸대." 맞은편에서 네빌 롱바텀이 얼굴을 붉힌다. 론의 누나가 멀리서 손을 흔든다.' },
    { id: 'm4', number: 4, role: 'user', speaker: USER, content: '"걱정 마, 네빌. 같이 찾아보자."' },
  ]);
}

function characterStore() {
  return { ...S.emptyStore(), cast: [NARRATOR], personas: [USER] };
}

function characterLedger() {
  return { ...L.emptyLedger(), cast: [NARRATOR], personas: [USER] };
}

/** The prompts character mode builds today, for the snapshot. */
function characterPrompts() {
  const s = slice();
  return {
    scene: S.buildScenePrompt(characterStore(), s, 4, null, {}),
    sceneNotebook: S.buildScenePrompt(characterStore(), s, 4, null, { notebook: true, quoteMode: 'both' }),
    ledger: L.buildPrompt(characterLedger(), s, []),
  };
}

module.exports = { NARRATOR, USER, slice, characterStore, characterLedger, characterPrompts };
