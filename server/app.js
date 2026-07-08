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

// 注入内存存储到游戏引擎
gameEngine.setStore(store);

// 创建 HTTP + WebSocket
const server = http.createServer(app);
wsService.init(server);

server.listen(config.port, () => {
  console.log('═══════════════════════════════════');
  console.log('  🐱 抓猫猫 游戏后端已就绪');
  console.log(`  HTTP:      http://localhost:${config.port}`);
  console.log(`  WebSocket: ws://localhost:${config.port}`);
  console.log('  存储模式:  纯内存（重启数据消失）');
  console.log('  依赖:      零外部依赖 ✅');
  console.log('═══════════════════════════════════');
});

process.on('SIGINT', () => {
  console.log('\n关闭服务器...');
  store.destroy();
  process.exit(0);
});
