const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  openId:   { type: String, required: true },
  nickName: { type: String, default: '玩家' },
  avatarUrl:{ type: String, default: '' },
  role:     { type: String, enum: ['seeker', 'hider', 'unassigned'], default: 'unassigned' },
  status:   { type: String, enum: ['alive', 'eliminated'], default: 'alive' },
  peekRemaining: { type: Number, default: 0 },
  eliminations:  { type: Number, default: 0 }, // 寻找者抓捕数
}, { _id: false });

const gameSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  status:   { type: String, enum: ['waiting','preparing','playing','ended'], default: 'waiting' },
  config: {
    duration:      { type: Number, default: 900 },
    peekCount:     { type: Number, default: 3 },
    captureRadius: { type: Number, default: 15 },
    zoneBoundary:  { type: Array, default: [] }, // [{lat, lng}, ...]
  },
  players:    [playerSchema],
  winner:     { type: String, enum: ['hiders', 'seekers', ''], default: '' },
  createdAt:  { type: Date, default: Date.now },
  startedAt:  { type: Date, default: null },
  endedAt:    { type: Date, default: null },
  // 历史记录用的摘要字段
  duration:   { type: Number, default: 0 },       // 实际用时(秒)
  playerCount:{ type: Number, default: 0 },
});

module.exports = mongoose.model('Game', gameSchema);
