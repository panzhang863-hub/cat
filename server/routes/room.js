const express = require('express');
const router = express.Router();
const store = require('../store/memory');
const { generateRoomCode } = require('../utils/roomCode');

// 创建房间
router.post('/create', async (req, res) => {
  try {
    const { openId, nickName, avatarUrl } = req.body;
    if (!openId) return res.status(400).json({ error: '缺少 openId' });

    let roomCode, exists, attempts = 0;
    do {
      roomCode = generateRoomCode();
      exists = store.findOne({ roomCode, status: { $ne: 'ended' } });
      attempts++;
    } while (exists && attempts < 10);

    if (exists) return res.status(500).json({ error: '生成房间码失败，请重试' });

    const game = store.create({
      roomCode,
      status: 'waiting',
      players: [{ openId, nickName: nickName || '房主', avatarUrl: avatarUrl || '', side: 'cat', slot: 0 }],
    });

    res.json({ roomCode: game.roomCode, gameId: game._id, players: game.players });
  } catch (err) {
    console.error('创建房间失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 加入房间
router.post('/join', async (req, res) => {
  try {
    const { roomCode, openId, nickName, avatarUrl } = req.body;
    if (!roomCode || !openId) return res.status(400).json({ error: '缺少参数' });

    const game = store.findOne({ roomCode });
    if (!game) return res.status(404).json({ error: '房间不存在' });
    if (game.status !== 'waiting' && game.status !== 'ended') return res.status(400).json({ error: '游戏进行中，无法加入' });

    // 老玩家直接放行
    const existing = game.players.find(p => p.openId === openId);
    if (existing) return res.json({ gameId: game._id, players: game.players, rejoined: true });

    // 昵称重复检查
    if (nickName && game.players.some(p => p.nickName === nickName))
      return res.status(400).json({ error: '昵称已被使用，请修改昵称' });

    if (game.players.length >= 30) return res.status(400).json({ error: '房间已满（最多30人）' });

    game.players.push({ openId, nickName: nickName || `玩家${game.players.length + 1}`, avatarUrl: avatarUrl || '', side: 'mouse', slot: 0 });
    await game.save();

    res.json({ gameId: game._id, players: game.players });
  } catch (err) {
    console.error('加入房间失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取房间信息
router.get('/:roomCode', async (req, res) => {
  try {
    const game = store.findOne({ roomCode: req.params.roomCode, status: { $ne: 'ended' } });
    if (!game) return res.status(404).json({ error: '房间不存在或已结束' });

    res.json({
      roomCode: game.roomCode, status: game.status,
      players: game.players, config: game.config, createdAt: game.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 切换角色（猫/鼠）+ 坑位位置
router.post('/:roomCode/side', async (req, res) => {
  try {
    const { openId, side, slot } = req.body;
    if (!openId || !['cat','mouse'].includes(side)) return res.status(400).json({ error: '参数错误' });

    const game = store.findOne({ roomCode: req.params.roomCode, status: 'waiting' });
    if (!game) return res.status(404).json({ error: '房间不存在' });

    const player = game.players.find(p => p.openId === openId);
    if (!player) return res.status(404).json({ error: '玩家不在房间' });

    // 检查上限
    const catCount = game.players.filter(p => p.side === 'cat').length;
    const mouseCount = game.players.filter(p => p.side === 'mouse').length;
    if (side === 'cat' && catCount >= 5 && player.side !== 'cat') return res.json({ ok: false, error: '猫猫已满' });
    if (side === 'mouse' && mouseCount >= 25 && player.side !== 'mouse') return res.json({ ok: false, error: '鼠鼠已满' });

    player.side = side;
    if (typeof slot === 'number') player.slot = slot;
    await game.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 保存房间配置（区域、时长、查看次数）
router.post('/:roomCode/config', async (req, res) => {
  try {
    const { openId, zoneBoundary, duration, peekCount } = req.body;
    const game = store.findOne({ roomCode: req.params.roomCode, status: 'waiting' });
    if (!game) return res.status(404).json({ error: '房间不存在' });
    if (game.players[0].openId !== openId) return res.status(403).json({ error: '只有房主可以修改配置' });

    if (zoneBoundary) game.config.zoneBoundary = zoneBoundary;
    if (duration) game.config.duration = duration;
    if (peekCount) game.config.peekCount = peekCount;
    await game.save();
    res.json({ ok: true, config: game.config });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 再来一局：重置房间
router.post('/:roomCode/rejoin', async (req, res) => {
  try {
    const { openId } = req.body;
    const game = store.findOne({ roomCode: req.params.roomCode, status: 'ended' });
    if (!game) return res.status(404).json({ error: '房间不存在' });
    if (!game.players.some(p => p.openId === openId)) return res.status(403).json({ error: '你不在房间中' });

    game.status = 'waiting';
    game.players.forEach(p => {
      p.status = 'alive';
      p.role = 'unassigned';
      p.peekRemaining = 0;
    });
    await game.save();
    res.json({ ok: true, gameId: game._id, players: game.players, config: game.config });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 离开房间
router.post('/:roomCode/leave', async (req, res) => {
  try {
    const { openId } = req.body;
    const game = store.findOne({ roomCode: req.params.roomCode });
    if (!game) return res.status(404).json({ error: '房间不存在' });

    const before=game.players.length;
    game.players = game.players.filter(p => p.openId !== openId);
    console.log('leave: room='+req.params.roomCode+' openId='+openId+' before='+before+' after='+game.players.length);
    await game.save();
    res.json({ success: true, removed: before-game.players.length });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
