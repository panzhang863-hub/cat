require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  wsPort: process.env.WS_PORT || 3001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hide-and-seek',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  wechatAppId: process.env.WECHAT_APPID || '',
  wechatAppSecret: process.env.WECHAT_APPSECRET || '',
  // 游戏默认配置
  game: {
    defaultDuration: 900,
    defaultPeekCount: 3,
    defaultCaptureRadius: 15,
    prepareTime: 5,
    peekDuration: 10,
    captureWindow: 10,
  }
};
