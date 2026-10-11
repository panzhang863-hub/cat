const express = require('express');
const http = require('http');
const cors = require('cors');
const config = require('./config');
const store = require('./store/memory');

const roomRoutes    = require('./routes/room');
const gameRoutes    = require('./routes/game');
const historyRoutes = require('./routes/history');
const wsService     = require('./services/websocket');
const gameEngine    = require('./services/gameEngine');
const contentCheck  = require('./services/contentCheck');

const app = express();

app.use(cors());
app.use(express.json());

// REST API
app.use('/api/room',    roomRoutes);
app.use('/api/game',    gameRoutes);
app.use('/api/history', historyRoutes);

// 昵称检查/注册
app.get('/api/nickname/check', (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: '缺少昵称' });
  const taken = store.isNicknameTaken(name);
  res.json({ available: !taken });
});
app.post('/api/nickname/register', async (req, res) => {
  const { name, openId } = req.body;
  if (!name || name.length > 8) return res.status(400).json({ error: '昵称格式不对' });
  if (store.isNicknameTaken(name)) return res.json({ ok: false, error: '昵称已被占用' });
  const checkResult = await contentCheck.msgSecCheck(openId || 'user_000', name);
  if (!checkResult.ok) return res.json({ ok: false, error: checkResult.errmsg || '昵称不合规' });
  store.registerNickname(name);
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), storage: 'memory' });
});

// 用户反馈收集（打印到控制台 + 存文件）
const fs=require('fs');const path=require('path');
app.post('/api/feedback', (req, res) => {
  const { openId, nickName, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '内容为空' });
  const line = `[${new Date().toISOString()}] ${nickName||'匿名'}(${openId||'?'}): ${text.trim()}`;
  console.log('💡 反馈:', line);
  fs.appendFileSync(path.join(__dirname,'feedbacks.log'), line+'\n');
  res.json({ success: true });
});

// 注入内存存储到游戏引擎
gameEngine.setStore(store);

// HTTPS 优先
const SSL_KEY = '/opt/cat-server/ssl/your-server.com.key';
const SSL_CERT = '/opt/cat-server/ssl/your-server.com_public.crt';
let server;
if (fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
  const https = require('https');
  server = https.createServer({ key: fs.readFileSync(SSL_KEY), cert: fs.readFileSync(SSL_CERT) }, app);
  console.log('[OK] HTTPS 已启用');
} else {
  server = http.createServer(app);
  console.log('[WARN] SSL 未找到，使用 HTTP');
}
wsService.init(server);

server.listen(config.port, () => {
  console.log('猫猫快追 已就绪 端口 ' + config.port);
});

process.on('SIGINT', () => {
  console.log('\n关闭服务器...');
  store.destroy();
  process.exit(0);
});
