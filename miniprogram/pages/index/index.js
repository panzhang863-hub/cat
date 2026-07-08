const app = getApp();

Page({
  data: {
    roomCode: '',
    nickName: '',
    creating: false,
    joining: false,
  },

  onLoad() {
    this.setData({ nickName: app.getNickName() });
  },

  // 输入房间码
  onRoomCodeInput(e) {
    this.setData({ roomCode: e.detail.value.toUpperCase() });
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  // 创建房间
  async onCreateRoom() {
    if (this.data.creating) return;
    this.setData({ creating: true });

    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/room/create`,
        method: 'POST',
        data: {
          openId: app.getOpenId(),
          nickName: this.data.nickName || app.getNickName(),
          avatarUrl: app.getAvatarUrl(),
        },
      });

      if (res.statusCode === 200) {
        wx.navigateTo({
          url: `/pages/lobby/lobby?roomCode=${res.data.roomCode}&isHost=1`,
        });
      } else {
        wx.showToast({ title: res.data.error || '创建失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    } finally {
      this.setData({ creating: false });
    }
  },

  // 加入房间
  async onJoinRoom() {
    const { roomCode, joining } = this.data;
    if (joining) return;
    if (!roomCode || roomCode.length !== 6) {
      wx.showToast({ title: '请输入6位房间码', icon: 'none' });
      return;
    }

    this.setData({ joining: true });

    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/room/join`,
        method: 'POST',
        data: {
          roomCode,
          openId: app.getOpenId(),
          nickName: this.data.nickName || app.getNickName(),
          avatarUrl: app.getAvatarUrl(),
        },
      });

      if (res.statusCode === 200) {
        wx.navigateTo({
          url: `/pages/lobby/lobby?roomCode=${roomCode}&isHost=0`,
        });
      } else {
        wx.showToast({ title: res.data.error || '加入失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    } finally {
      this.setData({ joining: false });
    }
  },

  // 查看历史
  onViewHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  onShareAppMessage() {
    return {
      title: '来玩躲猫猫！',
      path: '/pages/index/index',
    };
  },
});
