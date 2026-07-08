const express = require('express');
const router = express.Router();
const store = require('../store/memory');
const config = require('../config');
const gameEngine = require('../services/gameEngine');

// 启动游戏
router.post('/:roomCode/start', async (req, res) => {
  try {
    const { openId, zoneBoundary, duration, peekCount } = req.body;
    const game = store.findOne({ roomCode: req.params.roomCode });

    if (!game) return res.status(404).json({ error: '房间不存在' });
    if (game.players.length < 2) return res.status(400).json({ error: '至少需要2名玩家' });
    if (game.players[0].openId !== openId) return res.status(403).json({ error: '只有房主可以开始游戏' });

    game.config = {
      zoneBoundary: zoneBoundary || [],
      duration: duration || config.game.defaultDuration,
      peekCount: peekCount || config.game.defaultPeekCount,
      captureRadius: config.game.defaultCaptureRadius,
    };

    const totalPlayers = game.players.length;

    // 按用户自选阵营分配，不随机
    game.players.forEach(p => {
      p.role = (p.side === 'cat') ? 'seeker' : 'hider';
      p.status = p.status || 'alive';
      p.peekRemaining = p.role === 'seeker' ? game.config.peekCount : 0;
    });

    game.status = 'preparing';
    game.startedAt = new Date();
    game.playerCount = totalPlayers;
    await game.save();

    // 初始化实时游戏状态（替代 Redis）
    gameEngine.initGameState(game.roomCode, game);

    res.json({
      success: true,
      config: game.config,
      players: game.players.map(p => ({
        openId: p.openId, nickName: p.nickName,
        role: p.role, peekRemaining: p.peekRemaining,
      })),
      prepareTime: config.game.prepareTime,
    });
  } catch (err) {
    console.error('启动游戏失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取游戏状态
router.get('/:roomCode/state', async (req, res) => {
  try {
    const game = store.findOne({ roomCode: req.params.roomCode });
    if (!game) return res.status(404).json({ error: '游戏不存在' });

    res.json({
      roomCode: game.roomCode, status: game.status,
      config: game.config, players: game.players,
      winner: game.winner, startedAt: game.startedAt,
      endedAt: game.endedAt, duration: game.duration,
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 超时结束
router.post('/:roomCode/timeout', async (req, res) => {
  try {
    const game = store.findOne({ roomCode: req.params.roomCode, status: 'playing' });
    if (!game) return res.status(404).json({ error: '游戏不存在或已结束' });

    game.status = 'ended';
    game.winner = 'hiders';
    game.endedAt = new Date();
    if (game.startedAt) game.duration = Math.floor((Date.now() - new Date(game.startedAt).getTime()) / 1000);
    await game.save();

    res.json({ success: true, winner: 'hiders' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
