const app = getApp();

Page({
  data: {
    roomCode: '',
    winner: '',
    myRole: '',
    myStatus: '',
    isWin: false,
    gameDetail: null,
  },

  onLoad(options) {
    const { roomCode, winner, myRole, myStatus } = options;
    const isWin = (winner === 'hiders' && myRole === 'hider' && myStatus === 'alive') ||
                  (winner === 'seekers' && myRole === 'seeker');

    this.setData({ roomCode, winner, myRole, myStatus, isWin });

    this.fetchGameDetail();
  },

  async fetchGameDetail() {
    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/history/${this.data.roomCode}`,
        method: 'GET',
      });
      if (res.statusCode === 200) {
        this.setData({ gameDetail: res.data });
      }
    } catch (err) {
      console.error('获取详情失败:', err);
    }
  },

  // 再来一局
  onPlayAgain() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  // 查看历史
  onViewHistory() {
    wx.redirectTo({ url: '/pages/history/history' });
  },

  formatTime(seconds) {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  },
});
