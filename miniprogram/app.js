App({
  globalData: {
    openId: '',
    nickName: '',
    avatarUrl: '',
    serverUrl: 'http://localhost:3000',  // 后端地址
    wsUrl: 'ws://localhost:3000',         // WebSocket 地址
  },

  onLaunch() {
    // 微信登录获取 openId
    wx.login({
      success: (res) => {
        if (res.code) {
          // 实际项目中需要将 code 发送到后端换取 openId
          // 这里先用 code 作为临时标识
          this.globalData.openId = 'user_' + res.code.substring(0, 8);
          console.log('[App] 登录成功, openId:', this.globalData.openId);
        }
      }
    });

    // 获取用户信息（新版需要用户主动授权）
    wx.getUserInfo({
      success: (res) => {
        this.globalData.nickName = res.userInfo.nickName;
        this.globalData.avatarUrl = res.userInfo.avatarUrl;
      },
      fail: () => {
        // 用户拒绝授权，使用默认昵称
      }
    });
  },

  // 获取全局数据
  getOpenId() {
    if (!this.globalData.openId) {
      this.globalData.openId = 'user_' + Date.now().toString(36);
    }
    return this.globalData.openId;
  },

  getNickName() {
    return this.globalData.nickName || '玩家';
  },

  getAvatarUrl() {
    return this.globalData.avatarUrl || '';
  }
});
