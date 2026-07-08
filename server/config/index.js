require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  wsPort: process.env.WS_PORT || 3001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hide-and-seek',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  // 游戏默认配置
  game: {
    defaultDuration: 900,        // 默认15分钟
    defaultPeekCount: 3,         // 默认查看3次
    defaultCaptureRadius: 15,    // 抓捕半径15米
    prepareTime: 5,              // 准备时间5秒（测试用）
    peekDuration: 10,            // 查看持续10秒
    captureWindow: 10,           // 抓捕确认窗口10秒
  }
};
