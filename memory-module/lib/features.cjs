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
  addressBook: {
    label: '호칭 사전',
    description: '누가 누구를 어떻게 부르는지(보스·애칭·"○○ 씨" 같은 부르는 말)를 이미 저장된 대사에서 모아 기록합니다. 모델을 더 부르지 않습니다. 켜면 같은 부르는 말을 두 번 이상 쓴 사람 사이만 사전에 올라가고, 대사의 화자·상대를 확인할 때 ‘그 말로 불린 사람이 상대이고 화자는 아니다’로 씁니다. 답변에는 장면에 함께 있는 사람들의 호칭만 한 줄로 들어갑니다. 이미 있는 사전은 끄더라도 지우지 않습니다.',
    default: false,
    ready: true,
  },
  learnFromEdits: {
    label: '직접 고친 것 배우기',
    description: '장면 편집에서 대사의 말한 사람·들은 사람을 직접 고치면, 거기서 배울 만한 것(부르는 말, 같은 사람의 다른 이름)을 ‘제안’으로 모아 이름 정리 탭에 보여 줍니다. 제안은 누르기 전까지 아무것도 바꾸지 않고, 모델을 부르지 않습니다. 호칭 제안은 ‘호칭 사전’도 켜져 있을 때만 만듭니다.',
    default: false,
    ready: true,
  },
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
