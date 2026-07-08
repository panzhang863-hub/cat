const app = getApp();

Page({
  data: {
    roomCode: '',
    isHost: false,
    players: [],
    config: {
      duration: 900,
      peekCount: 3,
      zoneBoundary: [],
    },
    pollingTimer: null,
    refreshing: false,
  },

  onLoad(options) {
    const { roomCode, isHost } = options;
    this.setData({
      roomCode,
      isHost: isHost === '1',
    });
    this.fetchRoomInfo();
    // 每 3 秒轮询房间状态
    const timer = setInterval(() => this.fetchRoomInfo(), 3000);
    this.setData({ pollingTimer: timer });
  },

  onUnload() {
    if (this.data.pollingTimer) clearInterval(this.data.pollingTimer);
  },

  // 拉取房间信息
  async fetchRoomInfo() {
    if (this.data.refreshing) return;
    this.setData({ refreshing: true });

    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/room/${this.data.roomCode}`,
        method: 'GET',
      });

      if (res.statusCode === 200) {
        this.setData({
          players: res.data.players,
          config: res.data.config,
        });

        // 如果游戏已开始，自动跳转
        if (res.data.status === 'preparing' || res.data.status === 'playing') {
          if (this.data.pollingTimer) clearInterval(this.data.pollingTimer);
          wx.redirectTo({
            url: `/pages/game/game?roomCode=${this.data.roomCode}`,
          });
        }
      } else if (res.statusCode === 404) {
        wx.showToast({ title: '房间已解散', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } catch (err) {
      console.error('获取房间信息失败:', err);
    } finally {
      this.setData({ refreshing: false });
    }
  },

  // 去配置游戏（仅房主）
  onConfigure() {
    wx.navigateTo({
      url: `/pages/config/config?roomCode=${this.data.roomCode}&duration=${this.data.config.duration}&peekCount=${this.data.config.peekCount}`,
      events: {
        onConfigSaved: (data) => {
          this.setData({ config: data });
        }
      }
    });
  },

  // 离开房间
  async onLeave() {
    wx.showModal({
      title: '离开房间',
      content: '确定要离开吗？',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        try {
          await wx.request({
            url: `${app.globalData.serverUrl}/api/room/${this.data.roomCode}/leave`,
            method: 'POST',
            data: { openId: app.getOpenId() },
          });
        } catch (err) { /* ignore */ }
        if (this.data.pollingTimer) clearInterval(this.data.pollingTimer);
        wx.navigateBack();
      }
    });
  },

  // 开始游戏（仅房主）
  async onStartGame() {
    const { roomCode, config, players } = this.data;

    // 验证区域
    if (!config.zoneBoundary || config.zoneBoundary.length < 3) {
      wx.showModal({
        title: '还未设置游戏区域',
        content: '请先在「修改配置」中在地图上画出游戏区域（至少3个点）',
        showCancel: false,
      });
      return;
    }

    // 确认
    wx.showModal({
      title: '开始游戏',
      content: `即将开始：${config.duration / 60}分钟，寻找者${config.peekCount}次查看机会，${players.length}名玩家`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return;

        try {
          const res = await wx.request({
            url: `${app.globalData.serverUrl}/api/game/${roomCode}/start`,
            method: 'POST',
            data: {
              openId: app.getOpenId(),
              zoneBoundary: config.zoneBoundary,
              duration: config.duration,
              peekCount: config.peekCount,
            },
          });

          if (res.statusCode === 200 && res.data.success) {
            wx.showToast({ title: '游戏开始！', icon: 'success' });
            if (this.data.pollingTimer) clearInterval(this.data.pollingTimer);
            setTimeout(() => {
              wx.redirectTo({
                url: `/pages/game/game?roomCode=${roomCode}`,
              });
            }, 800);
          } else {
            wx.showToast({ title: res.data.error || '开始失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      }
    });
  },

  // 分享房间码
  onShare() {
    // 复制房间码到剪贴板
    wx.setClipboardData({
      data: this.data.roomCode,
      success: () => {
        wx.showToast({ title: '房间码已复制', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: `加入我的躲猫猫房间！房码: ${this.data.roomCode}`,
      path: `/pages/index/index`,
    };
  },
});
