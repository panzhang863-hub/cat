const app = getApp();

Page({
  data: {
    records: [],
    total: 0,
    loading: false,
    noMore: false,
  },

  onLoad() {
    this.loadHistory();
  },

  async loadHistory() {
    if (this.data.loading || this.data.noMore) return;
    this.setData({ loading: true });

    try {
      const res = await wx.request({
        url: `${app.globalData.serverUrl}/api/history`,
        method: 'GET',
        data: {
          openId: app.getOpenId(),
          limit: 20,
          offset: this.data.records.length,
        },
      });

      if (res.statusCode === 200) {
        const records = [...this.data.records, ...res.data.records];
        this.setData({
          records,
          total: res.data.total,
          noMore: records.length >= res.data.total,
        });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    this.loadHistory();
  },

  // 查看详情
  onTapRecord(e) {
    const { roomCode } = e.currentTarget.dataset;
    wx.showToast({ title: `详情: ${roomCode}`, icon: 'none' });
    // 可扩展为详情页
  },

  formatTime(seconds) {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  roleLabel(role) {
    return role === 'seeker' ? '🔍寻找者' : role === 'hider' ? '🙈躲藏者' : '未知';
  },
});
