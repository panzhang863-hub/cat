const app = getApp();
const { getGameSocket } = require('../../utils/ws');

Page({
  data: {
    roomCode: '',
    myRole: '',              // 'seeker' | 'hider'
    myStatus: 'alive',       // 'alive' | 'eliminated'
    peekRemaining: 0,

    // 地图
    mapCenter: { lat: 30.2741, lng: 120.1551 },
    zoneBoundary: [],        // 游戏区域多边形
    markers: [],             // 地图上的玩家标记
    polygons: [],            // 区域多边形

    // 游戏状态
    gameStatus: 'preparing', // preparing | playing | ended
    timeRemaining: 0,        // 剩余秒数
    prepareTime: 30,         // 准备倒计时

    // Peek 状态
    peekActive: false,
    peekExpiresIn: 0,
    peekHiders: [],

    // 抓捕
    captureTarget: null,      // 可抓捕目标
    captureExpiresIn: 0,

    // 淘汰日志
    elimLog: [],

    // UI 状态
    showRoleReveal: true,    // 角色揭示弹窗
    showResult: false,
    winner: '',
  },

  // ── 生命周期 ──
  onLoad(options) {
    const { roomCode } = options;
    this.setData({ roomCode });

    // 获取游戏状态
    this.fetchGameState();

    // 建立 WebSocket 连接
    const socket = getGameSocket();
    socket.connect(roomCode);
    this.setupWSListeners(socket);

    // 保持屏幕常亮
    wx.setKeepScreenOn({ keepScreenOn: true });

    // 开始位置上报
    this.startLocationTracking();
  },

  onUnload() {
    wx.setKeepScreenOn({ keepScreenOn: false });
    this.stopLocationTracking();
    getGameSocket().disconnect();
  },

  // ── 获取游戏初始状态 ──
  async fetchGameState() {
    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/game/${this.data.roomCode}/state`,
        method: 'GET',
      });
      if (res.statusCode === 200) {
        const game = res.data;
        const me = game.players.find(p => p.openId === app.getOpenId());
        if (me) {
          this.setData({
            myRole: me.role,
            peekRemaining: me.peekRemaining || 0,
            zoneBoundary: game.config.zoneBoundary || [],
            gameStatus: game.status,
            polygons: game.config.zoneBoundary && game.config.zoneBoundary.length >= 3
              ? [{ points: game.config.zoneBoundary, fillColor: '#FF6B3510', strokeColor: '#FF6B35', strokeWidth: 2 }]
              : [],
          });
        }
      }
    } catch (err) {
      console.error('获取游戏状态失败:', err);
    }
  },

  // ── WebSocket 事件 ──
  setupWSListeners(socket) {
    // 游戏开始
    socket.on('game_started', (data) => {
      this.setData({
        gameStatus: 'playing',
        showRoleReveal: false,
        timeRemaining: data.config.duration,
      });
      this.startCountdown(data.config.duration);
    });

    // 位置同步
    socket.on('positions_sync', (data) => {
      this.updateMarkers(data.players);
    });

    // 查看结果
    socket.on('peek_result', (data) => {
      this.setData({
        peekActive: true,
        peekExpiresIn: data.expiresIn,
        peekHiders: data.hiders,
        peekRemaining: data.remainingPeeks,
      });
      // Peek 期间隐藏者标记也会显示（positions_sync 会处理）
    });

    // Peek 过期
    socket.on('peek_expired', () => {
      this.setData({ peekActive: false, peekExpiresIn: 0, peekHiders: [] });
    });

    // 抓捕机会
    socket.on('capture_opportunity', (data) => {
      this.setData({
        captureTarget: data.target,
        captureExpiresIn: data.expiresIn,
      });
      wx.vibrateShort({ type: 'heavy' });
    });

    // 玩家淘汰
    socket.on('player_eliminated', (data) => {
      const reasonText = data.reason === 'out_of_bounds' ? '越界淘汰' :
                         data.reason === 'captured' ? '被抓到了！' : '淘汰';

      const log = [...this.data.elimLog];
      log.unshift({
        text: `${this.getPlayerName(data.openId)} ${reasonText}`,
        time: new Date().toLocaleTimeString(),
      });
      this.setData({ elimLog: log.slice(0, 10) });

      // 如果是我被淘汰
      if (data.openId === app.getOpenId()) {
        this.setData({ myStatus: 'eliminated' });
        wx.vibrateLong();
        wx.showToast({ title: '你被淘汰了！', icon: 'none', duration: 3000 });
      }

      // 清除抓捕目标
      if (this.data.captureTarget && data.openId === this.data.captureTarget.openId) {
        this.setData({ captureTarget: null });
      }
    });

    // 游戏结束
    socket.on('game_ended', (data) => {
      this.setData({
        gameStatus: 'ended',
        showResult: true,
        winner: data.winner,
      });
      this.stopLocationTracking();

      // 跳转结算页
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/result/result?roomCode=${this.data.roomCode}&winner=${data.winner}&myRole=${this.data.myRole}&myStatus=${this.data.myStatus}`,
        });
      }, 2000);
    });
  },

  // ── 位置追踪 ──
  startLocationTracking() {
    // 先获取一次初始位置
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          mapCenter: { lat: res.latitude, lng: res.longitude },
        });
      },
    });

    // 开始持续定位
    this.locationTimer = setInterval(() => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          const socket = getGameSocket();
          socket.sendPosition(res.latitude, res.longitude);

          // 更新地图中心（跟随用户）
          this.setData({
            mapCenter: { lat: res.latitude, lng: res.longitude },
          });
        },
        fail: (err) => {
          console.error('定位失败:', err);
          if (err.errMsg.includes('auth deny')) {
            wx.showToast({ title: '请授权位置权限', icon: 'none' });
          }
        },
      });
    }, 1000); // 每秒上报
  },

  stopLocationTracking() {
    if (this.locationTimer) {
      clearInterval(this.locationTimer);
      this.locationTimer = null;
    }
  },

  // ── 更新地图标记 ──
  updateMarkers(players) {
    const markers = players.map((p, i) => {
      const isMe = p.openId === app.getOpenId();
      const role = this.getRoleForPlayer(p.openId);
      return {
        id: i,
        latitude: p.lat,
        longitude: p.lng,
        width: 32,
        height: 32,
        iconPath: role === 'seeker' ? '/assets/marker-seeker.png' : '/assets/marker-hider.png',
        callout: isMe ? {
          content: '我',
          fontSize: 12,
          borderRadius: 8,
          padding: 4,
          bgColor: '#FF6B35',
          color: '#fff',
          display: 'ALWAYS',
        } : p.nickName ? {
          content: p.nickName,
          fontSize: 11,
          borderRadius: 6,
          padding: 3,
          display: 'ALWAYS',
        } : undefined,
        anchor: { x: 0.5, y: 1 },
      };
    });

    this.setData({ markers });
  },

  getRoleForPlayer(openId) {
    // 简化：根据上下文判断
    if (openId === app.getOpenId()) return this.data.myRole;
    // 查看模式下可以看到躲藏者位置，那些就是 hider
    if (this.data.peekActive) {
      const hider = this.data.peekHiders.find(h => h.openId === openId);
      if (hider) return 'hider';
    }
    return 'hider'; // 能在地图上看到的非自己玩家就是躲藏者
  },

  getPlayerName(openId) {
    if (openId === app.getOpenId()) return '你';
    const hider = this.data.peekHiders.find(h => h.openId === openId);
    if (hider) return hider.nickName;
    return '某玩家';
  },

  // ── 倒计时 ──
  startCountdown(totalSeconds) {
    this.setData({ timeRemaining: totalSeconds });
    this.countdownTimer = setInterval(() => {
      const remaining = this.data.timeRemaining - 1;
      this.setData({ timeRemaining: remaining });

      if (remaining <= 0) {
        clearInterval(this.countdownTimer);
        // 服务端会处理超时
      }
    }, 1000);
  },

  // ── 操作按钮 ──
  // 查看位置
  onPeek() {
    if (this.data.myRole !== 'seeker') {
      wx.showToast({ title: '只有寻找者可以查看', icon: 'none' });
      return;
    }
    if (this.data.peekRemaining <= 0) {
      wx.showToast({ title: '没有查看次数了', icon: 'none' });
      return;
    }
    getGameSocket().usePeek();
  },

  // 确认抓捕
  onConfirmCapture() {
    if (!this.data.captureTarget) return;
    getGameSocket().confirmCapture(this.data.captureTarget.openId);
    this.setData({ captureTarget: null });
    wx.showToast({ title: '已抓捕！', icon: 'success' });
  },

  // 关闭抓捕提示
  onDismissCapture() {
    this.setData({ captureTarget: null });
  },

  // ── 格式化显示 ──
  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  },

  // ── 返回房间 ──
  onBackToLobby() {
    wx.redirectTo({
      url: `/pages/lobby/lobby?roomCode=${this.data.roomCode}&isHost=0`,
    });
  },
});
