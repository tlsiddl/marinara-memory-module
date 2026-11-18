'use strict';
// Tracker API registration. The service owns the shared guard, storage, name context and view.
module.exports = function registerTrackerRoutes(app, { guard, safeChatId, needFeature, trackersView, A, Tk, loadTrackers, saveTrackers, storyToday, loadLedger, loadScenes, sceneDate }) {
  app.get('/chats/:id/trackers', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    needFeature(chatId, 'trackers');
    return trackersView(chatId);
  }));
  app.post('/chats/:id/trackers', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    needFeature(chatId, 'trackers');
    const b = req.body || {};
    const action = String(b.action || '');
    const id = String(b.id || '');
    const ACTIONS = ['add', 'edit', 'delete', 'start', 'addStart', 'removeStart', 'editStart', 'fromScene', 'accept', 'ignore', 'undoApplied'];
    if (!ACTIONS.includes(action)) throw Error(`${ACTIONS.join(', ')} 중 하나여야 합니다.`);
    // Read, change and save with no await in between, so a scan cannot overwrite the change.
    let undone = null;
    A.using(chatId, () => {
      const file = loadTrackers(chatId);
      let next;
      if (action === 'undoApplied') {
        // What an undo removes, told back to the screen (a recommended tracker goes with the start dates it has now).
        const rec = (file.applied || []).find((a) => a.id === String(b.aid || id));
        if (rec?.kind === 'newTracker') {
          const gone = file.items.find((t) => t.id === rec.trackerId);
          undone = { kind: 'newTracker', trackerId: rec.trackerId, label: gone?.label || rec.label || null, starts: gone?.cycle?.starts?.length || 0 };
        }
      }
      if (action === 'add') next = Tk.addItem(file, b.item);
      else if (action === 'edit') next = Tk.editItem(file, id, b.item);
      else if (action === 'delete') next = Tk.deleteItem(file, id);
      else if (action === 'start') {
        const item = file.items.find((t) => t.id === id);
        if (!item) throw Error('해당 트래커를 찾지 못했습니다.');
        const today = Tk.todayFor(item, { story: storyToday(chatId, loadLedger(chatId)), real: Tk.localDate() });
        if (!today) throw Error('이야기 속 오늘 날짜를 아직 알 수 없습니다. 시작일을 직접 적어 주세요.');
        next = Tk.addStart(file, id, today);
      } else if (action === 'addStart') next = Tk.addStart(file, id, b.date);
      else if (action === 'removeStart') next = Tk.removeStart(file, id, b.date);
      else if (action === 'editStart') next = Tk.editStart(file, id, b.from, b.to);
      else if (action === 'fromScene') {
        const scene = (loadScenes(chatId)?.scenes || []).find((s) => s.id === String(b.sceneId || ''));
        if (!scene) throw Error('해당 장면을 찾지 못했습니다.');
        const date = sceneDate(chatId, scene);
        if (!date) throw Error('이 장면에는 작중 날짜가 없습니다.');
        next = Tk.startFromDate(file, { trackerId: id, label: b.label, scope: b.scope, people: b.people, clock: 'story', date });
      } else if (action === 'undoApplied') next = Tk.undoApplied(file, String(b.aid || id));
      else next = Tk.answerSuggestion(file, String(b.sid || id), action);
      saveTrackers(chatId, next);
    });
    return undone ? { ...trackersView(chatId), undone } : trackersView(chatId);
  }));
};
