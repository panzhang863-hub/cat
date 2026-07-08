const express = require('express');
const router = express.Router();
const store = require('../store/memory');

// 历史列表
router.get('/', async (req, res) => {
  try {
    const { openId, limit = 20, offset = 0 } = req.query;
    if (!openId) return res.status(400).json({ error: '缺少 openId' });

    const all = [];
    // 收集这个用户参加过的所有已结束游戏
    for (const game of store.games.values()) {
      if (game.status !== 'ended') continue;
      if (!game.players.some(p => p.openId === openId)) continue;
      const me = game.players.find(p => p.openId === openId);
      all.push({
        roomCode: game.roomCode,
        winner: game.winner,
        duration: game.duration,
        playerCount: game.playerCount,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
        myRole: me ? me.role : 'unassigned',
        myStatus: me ? me.status : 'unknown',
      });
    }

    all.sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));
    const records = all.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({ records, total: all.length, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    console.error('获取历史失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 历史详情
router.get('/:roomCode', async (req, res) => {
  try {
    const game = store.findOne({ roomCode: req.params.roomCode, status: 'ended' });
    if (!game) return res.status(404).json({ error: '记录不存在' });

    res.json({
      roomCode: game.roomCode, winner: game.winner,
      duration: game.duration, playerCount: game.playerCount,
      startedAt: game.startedAt, endedAt: game.endedAt,
      config: game.config,
      players: game.players.map(p => ({
        openId: p.openId, nickName: p.nickName,
        role: p.role, status: p.status, eliminations: p.eliminations,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
