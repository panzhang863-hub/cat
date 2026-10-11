/**
 * 统一配置管理
 * 优先级：localStorage（用户手动设置）> 环境变量 > 默认值
 */

const DEFAULTS = {
  serverUrl: 'https://your-server.com',
  wsUrl: 'wss://your-server.com',
  gpsInterval: 3000, // GPS 上报间隔（毫秒）
};

const STORAGE_KEY = 'catchcat_config';

function loadFromStorage() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return {};
}

function saveToStorage(cfg) {
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) { /* ignore */ }
}

export function getConfig() {
  const env = {};
  // #ifdef H5
  // H5 环境：尝试从 URL 参数读取（方便测试）
  // #endif
  return { ...DEFAULTS, ...env, ...loadFromStorage() };
}

export function setServerUrl(url) {
  if (!url) return;
  let ws = url;
  if (url.startsWith('https://')) ws = url.replace('https://', 'wss://');
  else if (url.startsWith('http://')) ws = url.replace('http://', 'ws://');
  if (!ws.startsWith('ws')) ws = 'ws://' + ws;
  const cfg = loadFromStorage();
  cfg.serverUrl = url;
  cfg.wsUrl = ws;
  saveToStorage(cfg);
}

export function getServerUrl() {
  return getConfig().serverUrl;
}

export function getWsUrl() {
  return getConfig().wsUrl;
}

export function getGpsInterval() {
  return getConfig().gpsInterval || 3000;
}

export function setGpsInterval(ms) {
  const cfg = loadFromStorage();
  cfg.gpsInterval = ms;
  saveToStorage(cfg);
}
