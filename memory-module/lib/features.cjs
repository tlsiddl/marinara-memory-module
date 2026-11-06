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
//
// BUILTIN names are features that used to have (or never had) a switch and are now part of the module itself: they are
// always on, are not in the registry, are not shown under 추가 기능 and ignore whatever an older settings file stored.

const MODES = ['default', 'on', 'off'];
/** 호칭 사전, 직접 고친 것 배우기, 아는 사람·모르는 사람, 기록 충돌 알림: always on. */
const BUILTIN = ['addressBook', 'learnFromEdits', 'knowledge', 'conflicts'];
const isBuiltin = (key) => BUILTIN.includes(key);

const FEATURES = {
  recentLife: {
    label: '최근 생활 기록',
    description: '누가 언제 먹고 씻고 잤는지 기록해 기억 칸에 넣습니다. 끄면 새 메시지에서 생활을 읽지 않고(기억 모델에 보내는 지침이 짧아집니다) 기억 칸에도 넣지 않습니다. 이미 있는 기록은 지우지 않으며, 다시 켜면 그대로 보이고 그 뒤 새 메시지부터 이어서 기록합니다. 꺼져 있던 동안의 메시지는 \'처음부터 다시 정리\'를 해야 채워집니다.',
    default: true,
    ready: true,
    legacy: { global: 'routine', room: 'routine' },
  },
  characterState: {
    label: '인물 현재 상태',
    description: '인물마다 지금 있는 곳·옷차림·다친 곳·가진 물건·기분을 카드로 기록합니다. 켜면 장면을 정리할 때 같은 모델 호출에 이 기록이 덧붙어(호출 수는 그대로, 답이 조금 길어집니다) 새로 정리하는 장면부터 채워집니다. 답변에는 지금 장면에 있는 사람의 상태만 한 줄로 들어갑니다. 직접 고친 항목은 자동 기록이 덮어쓰지 않습니다. 이미 있는 카드는 끄더라도 지우지 않습니다.',
    default: false,
    ready: true,
  },
  places: {
    label: '장소 기억',
    description: '이야기에 나온 장소의 모습(가구·전망·배치 등)을 장소별로 모아 기록합니다. 켜면 장면을 정리할 때 같은 모델 호출에 이 기록이 덧붙어(호출 수는 그대로, 답이 조금 길어집니다) 새로 정리하는 장면부터 채워집니다. 답변에는 지금 장면의 장소만 한 줄로 들어갑니다. 같은 곳의 다른 이름은 장소 화면에서 직접 묶습니다. 이미 있는 기록은 끄더라도 지우지 않습니다.',
    default: false,
    ready: true,
  },
  keepsakes: {
    label: '소중한 물건',
    description: '선물·기념품·유품처럼 이야기에서 뜻이 있는 물건(누가 누구에게 받았는지, 어떤 뜻인지, 지금 어디에 있는지)을 물건별로 기록합니다. 켜면 장면을 정리할 때 같은 모델 호출에서 함께 읽으므로 호출은 늘지 않고, 정리 요청에 안내가 조금 더 붙습니다. 새로 정리하는 장면부터 채워집니다. 답변에는 지금 장면에 있는 사람의 물건만 한 줄로 들어갑니다. 직접 고친 항목은 자동 기록이 덮어쓰지 않습니다. 이미 있는 기록은 꺼도 지우지 않습니다.',
    default: false,
    ready: true,
  },
  recallReasons: { label: '회상 이유 보기', description: '왜 그 기억이 골라졌는지 이유를 보여 줍니다.', default: false, ready: false },
};

const known = (key) => Object.prototype.hasOwnProperty.call(FEATURES, key);

/** { global, room, enabled } for one feature in one room, from a settings object. Unknown values follow the default. */
function resolve(all, chatId, key, registry = FEATURES) {
  if (isBuiltin(key)) return { global: true, room: 'default', enabled: true, ready: true, builtin: true };
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

module.exports = { FEATURES, MODES, BUILTIN, isBuiltin, known, resolve, withGlobal, withRoomMode, view };
