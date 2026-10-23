// A stand-in OpenAI-compatible model for tests. Never talks to a real provider.
// Memory-manager prompts get a ledger JSON built from the numbered sentences; anything else gets an RP reply.
// Usage: node tests/fake-llm.mjs <port> [reply text file]
import http from 'node:http';
import fs from 'node:fs';

const port = Number(process.argv[2] || 9911);
const replyFile = process.argv[3];
const calls = { memory: 0, rp: 0 };

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

function rpReply() {
  if (replyFile && fs.existsSync(replyFile)) return fs.readFileSync(replyFile, 'utf8');
  return '단테가 웃었다. "약속할게, 내일 같이 산책 가자."';
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
      if (isMemory && system.includes('열린 항목을 점검해')) {
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
        content = rpReply();
      }
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
    });
  })
  .listen(port, '127.0.0.1', () => console.log(`fake llm on ${port}`));
