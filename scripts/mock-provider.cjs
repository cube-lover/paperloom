const http = require('node:http');
// Only a loopback integration-test fixture. Does not forward requests to an LLM.
const server = http.createServer((req, res) => {
  let input = ''; req.on('data', chunk => { input += chunk; if (input.length > 500000) req.destroy(); });
  req.on('end', () => {
    try {
      const body = JSON.parse(input);
      const source = body.messages.at(-1).content.replace(/^<source>\n|\n<\/source>$/g, '');
      const content = '模拟译文：' + source.replace('The measured', '测得的').replace('Methods:', '方法：');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }] }));
    } catch { res.writeHead(400); res.end('{}'); }
  });
});
server.listen(18767, '127.0.0.1');
