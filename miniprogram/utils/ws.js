/**
 * WebSocket 连接管理
 */
const app = getApp();

class GameSocket {
  constructor() {
    this.socket = null;
    this.roomCode = '';
    this.openId = '';
    this.listeners = {};
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
  }

  /**
   * 连接到游戏房间
   */
  connect(roomCode) {
    this.roomCode = roomCode;
    this.openId = app.getOpenId();

    const wsUrl = `${app.globalData.wsUrl}?room=${roomCode}&openId=${this.openId}`;

    this.socket = wx.connectSocket({
      url: wsUrl,
      success: () => console.log('[WS] 连接中...'),
      fail: (err) => console.error('[WS] 连接失败:', err),
    });

    this.socket.onOpen(() => {
      console.log('[WS] 已连接');
      this._startHeartbeat();
    });

    this.socket.onMessage((res) => {
      try {
        const msg = JSON.parse(res.data);
        this._dispatch(msg.type, msg.data);
      } catch (e) {
        console.error('[WS] 消息解析失败:', e);
      }
    });

    this.socket.onClose((res) => {
      console.log('[WS] 断开:', res.code, res.reason);
      this._stopHeartbeat();
      // 自动重连
      if (res.code !== 1000) {
        this._scheduleReconnect();
      }
    });

    this.socket.onError((err) => {
      console.error('[WS] 错误:', err);
    });
  }

  /**
   * 发送消息
   */
  send(type, data = {}) {
    if (!this.socket) return;
    this.socket.send({
      data: JSON.stringify({ type, data }),
      fail: (err) => console.error('[WS] 发送失败:', err),
    });
  }

  /**
   * 上报位置
   */
  sendPosition(lat, lng) {
    this.send('position_update', { lat, lng });
  }

  /**
   * 使用查看位置
   */
  usePeek() {
    this.send('use_peek', {});
  }

  /**
   * 确认抓捕
   */
  confirmCapture(targetOpenId) {
    this.send('confirm_capture', { targetOpenId });
  }

  /**
   * 监听事件
   */
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  /**
   * 移除监听
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * 断开连接
   */
  disconnect() {
    this._stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close({ code: 1000, reason: '用户离开' });
      this.socket = null;
    }
    this.listeners = {};
  }

  // ── 内部方法 ──

  _dispatch(type, data) {
    const cbs = this.listeners[type] || [];
    cbs.forEach(cb => cb(data));
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket) {
        this.socket.send({ data: JSON.stringify({ type: 'ping' }) });
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
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[WS] 尝试重连...');
      this.connect(this.roomCode);
    }, 3000);
  }
}

// 单例
let instance = null;
function getGameSocket() {
  if (!instance) instance = new GameSocket();
  return instance;
}

module.exports = { getGameSocket };
