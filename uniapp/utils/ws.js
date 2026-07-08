/**
 * WebSocket 连接管理 (Uni-app 版本)
 */

let instance = null;

class GameSocket {
  constructor() {
    this.socketTask = null;
    this.roomCode = '';
    this.openId = '';
    this.listeners = {};
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.intentionalClose = false;
    this.reconnectDelay = 1000; // 初始重连延迟，成功后重置
  }

  connect(roomCode, openId) {
    this.roomCode = roomCode;
    this.openId = openId;
    this.intentionalClose = false;

    const wsUrl = `${getApp().globalData.wsUrl}?room=${roomCode}&openId=${openId}`;

    this.socketTask = uni.connectSocket({
      url: wsUrl,
      success: () => console.log('[WS] 连接中...'),
      fail: (err) => console.error('[WS] 连接失败:', err),
    });

    this.socketTask.onOpen(() => {
      console.log('[WS] 已连接');
      this.reconnectDelay = 1000; // 连接成功，重置退避
      this._startHeartbeat();
    });

    this.socketTask.onMessage((res) => {
      try {
        const msg = JSON.parse(res.data);
        this._dispatch(msg.type, msg.data);
      } catch (e) {
        console.error('[WS] 消息解析失败:', e);
      }
    });

    this.socketTask.onClose((res) => {
      console.log('[WS] 断开:', res.code, res.reason);
      this._stopHeartbeat();
      if (!this.intentionalClose && res.code !== 1000) {
        this._scheduleReconnect();
      }
    });

    this.socketTask.onError((err) => {
      console.error('[WS] 错误:', err);
    });
  }

  send(type, data = {}) {
    if (!this.socketTask) return;
    this.socketTask.send({
      data: JSON.stringify({ type, data }),
      fail: (err) => console.error('[WS] 发送失败:', err),
    });
  }

  sendPosition(lat, lng) {
    this.send('position_update', { lat, lng });
  }

  usePeek() {
    this.send('use_peek', {});
  }

  confirmCapture(targetOpenId) {
    this.send('confirm_capture', { targetOpenId });
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  disconnect() {
    this.intentionalClose = true;
    this._stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socketTask) {
      this.socketTask.close({ code: 1000, reason: '用户离开' });
      this.socketTask = null;
    }
    this.listeners = {};
  }

  _dispatch(type, data) {
    const cbs = this.listeners[type] || [];
    cbs.forEach(cb => cb(data));
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socketTask) {
        this.socketTask.send({ data: JSON.stringify({ type: 'ping' }) });
      }
    }, 30000);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    console.log(`[WS] ${delay/1000}s 后尝试重连...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // 指数退避：1s → 2s → 4s → 8s → max 30s
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect(this.roomCode, this.openId);
    }, delay);
  }
}

function getGameSocket() {
  if (!instance) instance = new GameSocket();
  return instance;
}

export { getGameSocket };
