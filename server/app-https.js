const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const config = require('./config');
const store = require('./store/memory');

const roomRoutes    = require('./routes/room');
const gameRoutes    = require('./routes/game');
const historyRoutes = require('./routes/history');
const wsService     = require('./services/websocket');
const gameEngine    = require('./services/gameEngine');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/room',    roomRoutes);
app.use('/api/game',    gameRoutes);
app.use('/api/history', historyRoutes);

app.get('/api/nickname/check', (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: '缺少昵称' });
  const taken = store.isNicknameTaken(name);
  res.json({ available: !taken });
});
app.post('/api/nickname/register', (req, res) => {
  const { name } = req.body;
  if (!name || name.length > 8) return res.status(400).json({ error: '昵称格式不对' });
  if (store.isNicknameTaken(name)) return res.json({ ok: false, error: '昵称已被占用' });
  store.registerNickname(name);
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), storage: 'memory' });
});

app.post('/api/feedback', (req, res) => {
  const { openId, nickName, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '内容为空' });
  const line = `[${new Date().toISOString()}] ${nickName||'匿名'}(${openId||'?'}): ${text.trim()}`;
  console.log('💡 反馈:', line);
  fs.appendFileSync(path.join(__dirname,'feedbacks.log'), line+'\n');
  res.json({ success: true });
});

gameEngine.setStore(store);

// 优先 HTTPS，SSL 证书没找到则降级 HTTP
let server;
try {
  server = https.createServer({
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'your-server.com.key')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'your-server.com.pem')),
  }, app);
  console.log('[OK] HTTPS 已启用');
} catch(e) {
  console.log('[WARN] SSL 文件未找到，使用 HTTP:', e.message);
  server = http.createServer(app);
}

wsService.init(server);

server.listen(config.port, () => {
  console.log('═══════════════════════════════════');
  console.log('  🐱 猫猫快追 游戏后端已就绪');
  console.log(`  端口: ${config.port}`);
  console.log('  存储: 纯内存');
  console.log('═══════════════════════════════════');
});

process.on('SIGINT', () => {
  console.log('\n关闭服务器...');
  store.destroy();
  process.exit(0);
});
