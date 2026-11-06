'use strict';
// Optional features ("추가 기능"): a registry, a global default and a per-room override for each.
//
// Storage (settings.json):
//   settings.features[key]        true | false        global default (missing = the registry default)
//   settings.chats[id].features[key]  'on' | 'off'   per-room override (missing = follow the default)
// "recentLife" keeps its original keys, so settings files written before this registry keep working unchanged:
//   settings.routine === false    global default off
//   settings.chats[id].routine    'on' | 'off'
//
// A feature with ready:false is not implemented yet: it is hidden from the screen, its switches cannot be saved and
// featureOn() answers false for it, so nothing can run by accident.

const MODES = ['default', 'on', 'off'];

const FEATURES = {
  recentLife: {
    label: '최근 생활 기록',
    description: '누가 언제 먹고 씻고 잤는지 기록해 기억 칸에 넣습니다. 끄면 새 메시지에서 생활을 읽지 않고(기억 모델에 보내는 지침이 짧아집니다) 기억 칸에도 넣지 않습니다. 이미 있는 기록은 지우지 않으며, 다시 켜면 그대로 보이고 그 뒤 새 메시지부터 이어서 기록합니다. 꺼져 있던 동안의 메시지는 \'처음부터 다시 정리\'를 해야 채워집니다.',
    default: true,
    ready: true,
    legacy: { global: 'routine', room: 'routine' },
  },
  addressBook: { label: '호칭 장부', description: '누가 누구를 어떻게 부르는지 기록합니다.', default: false, ready: false },
  learnFromEdits: { label: '고친 내용 배우기', description: '직접 고친 내용을 다음 정리에 반영합니다.', default: false, ready: false },
  characterState: { label: '캐릭터 상태', description: '인물별 현재 상태(몸·마음·옷차림 등)를 따로 기록합니다.', default: false, ready: false },
  places: { label: '장소 기록', description: '이야기에 나온 장소를 모아 기록합니다.', default: false, ready: false },
  knowledge: { label: '아는 것·모르는 것', description: '인물별로 무엇을 알고 모르는지 기록합니다.', default: false, ready: false },
  conflicts: { label: '기억 충돌 점검', description: '서로 어긋나는 기억을 찾아 알려 줍니다.', default: false, ready: false },
  recallReasons: { label: '회상 이유 보기', description: '왜 그 기억이 골라졌는지 이유를 보여 줍니다.', default: false, ready: false },
};

const known = (key) => Object.prototype.hasOwnProperty.call(FEATURES, key);

/** { global, room, enabled } for one feature in one room, from a settings object. Unknown values follow the default. */
function resolve(all, chatId, key, registry = FEATURES) {
  const f = registry[key];
  if (!f) return { global: false, room: 'default', enabled: false, ready: false };
  const room = all?.chats?.[chatId];
  let global;
  let raw;
  if (f.legacy) {
    global = f.default ? all?.[f.legacy.global] !== false : all?.[f.legacy.global] === true;
    raw = room?.[f.legacy.room];
  } else {
    const stored = all?.features?.[key];
    global = typeof stored === 'boolean' ? stored : f.default;
    raw = room?.features?.[key];
  }
  const mode = MODES.includes(raw) ? raw : 'default';
  const enabled = mode === 'default' ? global : mode === 'on';
  return { global, room: mode, enabled: f.ready ? enabled : false, ready: !!f.ready };
}

/** Returns a copy of settings with the global default of one feature set. */
function withGlobal(all, key, on, registry = FEATURES) {
  const f = registry[key];
  if (f?.legacy) return { ...all, [f.legacy.global]: on };
  return { ...all, features: { ...(all.features || {}), [key]: on } };
}

/** Returns a copy of settings with a room's mode for one feature set ('default' stores nothing). */
function withRoomMode(all, chatId, key, mode, registry = FEATURES) {
  const f = registry[key];
  const room = { ...(all.chats?.[chatId] || {}) };
  if (f?.legacy) {
    if (mode === 'default') delete room[f.legacy.room];
    else room[f.legacy.room] = mode;
  } else {
    const features = { ...(room.features || {}) };
    if (mode === 'default') delete features[key];
    else features[key] = mode;
    if (Object.keys(features).length) room.features = features;
    else delete room.features;
  }
  return { ...all, chats: { ...(all.chats || {}), [chatId]: room } };
}

/** What the screen needs: only features that are ready, with labels and the current state for the room. */
function view(all, chatId, registry = FEATURES) {
  return Object.entries(registry).filter(([, f]) => f.ready).map(([key, f]) => ({
    key, label: f.label, description: f.description, default: f.default, ...resolve(all, chatId, key, registry),
  }));
}

module.exports = { FEATURES, MODES, known, resolve, withGlobal, withRoomMode, view };
