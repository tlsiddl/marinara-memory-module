// A stand-in OpenAI-compatible model for tests. Never talks to a real provider.
// Memory-manager prompts get a ledger JSON built from the numbered sentences; anything else gets an RP reply.
// Usage: node tests/fake-llm.mjs <port> [reply text file]
import http from 'node:http';
import fs from 'node:fs';

const port = Number(process.argv[2] || 9911);
const replyFile = process.argv[3];
const calls = { memory: 0, rp: 0 };
let memoryDelayMs = 0;
let lastRpPrompt = '';

function ledgerReply(user) {
  const lines = [...user.matchAll(/^\[(\d+\.\d+)\] (.*)$/gm)];
  const open = [];
  const close = [];
  const ids = [...user.matchAll(/^(T\d+) \[(\w+)\] (.*)$/gm)];
  for (const [, id, text] of lines) {
    if (/약속|promise/i.test(text)) open.push({ kind: 'promise', title: `약속 ${id}`, who: null, toward: null, detail: text.slice(0, 60), evidence: [id] });
    if (/화가|화났|서운/.test(text)) open.push({ kind: 'emotion', title: `감정 ${id}`, who: null, toward: null, detail: null, cause: '본문 근거', need: '사과', evidence: [id] });
    if (/화해|사과했/.test(text) && ids.some(([, , kind]) => kind === 'emotion')) {
      const emotion = ids.find(([, , kind]) => kind === 'emotion');
      close.push({ id: emotion[1], how: '사과', evidence: [id] });
    }
  }
  return { open: open.slice(0, 3), update: [], close };
}

/** Scenes of up to 6 messages, the last one closing exactly at the required number. */
function sceneReply(user) {
  const required = Number(user.match(/\[필수 끝 번호\] (\d+)/)[1]);
  const numbers = [...user.matchAll(/^\[(\d+)\] /gm)].map((m) => Number(m[1]));
  const firstLine = (n) => (user.match(new RegExp(`^\\[${n}\\.1\\] (.*)$`, 'm')) || [])[1] || '';
  const upTo = numbers.filter((n) => n <= required);
  const scenes = [];
  for (let i = 0; i < upTo.length; i += 6) {
    const part = upTo.slice(i, i + 6);
    const n = part[0];
    scenes.push({
      end: part.at(-1),
      time: null,
      place: null,
      title: `장면 ${n}`,
      summary: `메시지 ${n}~${part.at(-1)}에서 있었던 일.`,
      events: part.filter((_, k) => k % 3 === 0).map((m) => ({ text: `${m}번에서 일이 일어남`, quotes: [{ n: `${m}.1`, q: firstLine(m).slice(0, 12), by: '하루', to: '서아' }] })),
      recollections: [{ who: '하루', text: '그때를 기억한다.', remembers: 'full' }, { who: '서아', text: '흐릿하다.', remembers: 'partial', why: '열' }],
      facts: i === 0 ? [{ about: '서아', text: `시험용 사실 ${n}`, evidence: [{ n: `${n}.1`, q: firstLine(n).slice(0, 12) }] }] : [],
    });
  }
  return { scenes };
}

function rpReply() {
  if (replyFile && fs.existsSync(replyFile)) return fs.readFileSync(replyFile, 'utf8');
  return '하루가 웃었다. "약속할게, 내일 같이 달빛호수 가자."';
}

http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (req.url.endsWith('/models')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ data: [{ id: 'fake-model' }] }));
      }
      const delay = req.url.match(/^\/__delay\/(\d+)$/);
      if (delay) {
        memoryDelayMs = Number(delay[1]);
        res.writeHead(200);
        return res.end('ok');
      }
      if (req.url.endsWith('/embeddings')) {
        // A bag of two-letter pieces hashed into 64 numbers: texts sharing words point the same way.
        let input = [];
        try {
          input = JSON.parse(body || '{}').input || [];
        } catch {}
        calls.embeddings = (calls.embeddings || 0) + 1;
        calls.embeddedTexts = (calls.embeddedTexts || 0) + input.length;
        const vec = (text) => {
          const v = new Array(64).fill(0);
          const t = String(text).replace(/\s+/g, '');
          for (let i = 0; i + 2 <= t.length; i++) {
            let h = 0;
            for (const ch of t.slice(i, i + 2)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
            v[h % 64] += 1;
          }
          return v;
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ data: input.map((t, index) => ({ index, embedding: vec(t) })), model: 'fake-embed' }));
      }
      if (req.url === '/__lastrp') {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end(lastRpPrompt);
      }
      if (req.url === '/__calls') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(calls));
      }
      let input = {};
      try {
        input = JSON.parse(body || '{}');
      } catch {}
      const messages = input.messages || [];
      const system = messages.find((m) => m.role === 'system')?.content || '';
      const isMemory = typeof system === 'string' && system.startsWith('너는 장기 롤플레이의 기억 관리자야');
      let content;
      if (isMemory && system.includes('지난 장면을 목차에서 골라')) {
        calls.recall = (calls.recall || 0) + 1;
        const user = messages.find((m) => m.role === 'user')?.content || '';
        const first = (user.match(/^(S\d+) \|/m) || [])[1];
        content = JSON.stringify({ recall: first ? [{ scene: first, why: '테스트 회상' }, { scene: 'S999', why: '없는 장면' }] : [] });
      } else if (isMemory && system.includes('한 챕터로 묶어 요약해')) {
        calls.chapters = (calls.chapters || 0) + 1;
        const user = messages.find((m) => m.role === 'user')?.content || '';
        const first = (user.match(/^(S\d+) \|/m) || [])[1] || 'S1';
        const ids = [...user.matchAll(/^(S\d+) \|/gm)].map((m) => m[1]);
        content = JSON.stringify({ end: ids[7] || ids.at(-1), title: `테스트 챕터 ${calls.chapters}`, summary: '테스트로 묶은 시기다. 여러 일이 있었다.', turns: [`${first} 테스트 전환점`] });
      } else if (isMemory && system.includes("'알게 된 사실' 목록을 정리해")) {
        calls.factMerges = (calls.factMerges || 0) + 1;
        const user = messages.find((m) => m.role === 'user')?.content || '';
        const ids = [...user.matchAll(/^- (F\d+) /gm)].map((m) => m[1]);
        content = JSON.stringify({ merged: ids.length >= 2 ? [{ text: '테스트로 합친 사실', from: ids.slice(0, 2) }] : [] });
      } else if (isMemory && system.includes('지나간 대화를 장면으로')) {
        calls.scenes = (calls.scenes || 0) + 1;
        const user = messages.find((m) => m.role === 'user')?.content || '';
        content = JSON.stringify(sceneReply(user));
      } else if (isMemory && system.includes('그 뒤 이야기에서 풀렸는지')) {
        calls.feelings = (calls.feelings || 0) + 1;
        const user = messages.find((m) => m.role === 'user')?.content || '';
        const id = (user.match(/^(T\d+) \[emotion\]/m) || [])[1];
        const line = [...user.matchAll(/^\[(\d+\.\d+)\] (.*)$/gm)].at(-1);
        content = JSON.stringify({ resolved: id && line ? [{ id, how: '테스트로 풀림', evidence: [{ n: line[1], q: line[2].slice(0, 10) }] }] : [] });
      } else if (isMemory && system.includes('열린 항목을 점검해')) {
        calls.tidy = (calls.tidy || 0) + 1;
        const user = messages.find((m) => m.role === 'user')?.content || '';
        const ids = [...user.matchAll(/^(T\d+) \[(\w+)\]/gm)].filter((m) => m[2] !== 'emotion').map((m) => m[1]);
        content = JSON.stringify({ close: ids.length ? [{ id: ids[0], how: '테스트 점검', why: 'momentary' }] : [], merge: ids.length > 2 ? [{ keep: ids[1], drop: [ids[2]] }] : [] });
      } else if (isMemory) {
        calls.memory++;
        const user = messages.find((m) => m.role === 'user')?.content || '';
        content = JSON.stringify(ledgerReply(user));
      } else {
        calls.rp++;
        lastRpPrompt = JSON.stringify(messages);
        content = rpReply();
      }
      const send = () => {
      if (input.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
        res.write(chunk({ role: 'assistant', content }));
        res.write(chunk({}, 'stop'));
        res.end('data: [DONE]\n\n');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'x', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
      };
      if (isMemory && memoryDelayMs) setTimeout(send, memoryDelayMs);
      else send();
    });
  })
  .listen(port, '127.0.0.1', () => console.log(`fake llm on ${port}`));
