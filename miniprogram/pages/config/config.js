const app = getApp();

Page({
  data: {
    roomCode: '',
    duration: 900,        // 秒
    peekCount: 3,
    zoneBoundary: [],      // 多边形顶点
    mapCenter: { lat: 30.2741, lng: 120.1551 },  // 默认杭州
  },

  onLoad(options) {
    this.setData({
      roomCode: options.roomCode,
      duration: parseInt(options.duration) || 900,
      peekCount: parseInt(options.peekCount) || 3,
    });
  },

  // 地图点击添加顶点
  onMapTap(e) {
    const { latitude, longitude } = e.detail;
    const boundary = [...this.data.zoneBoundary, { lat: latitude, lng: longitude }];

    // 如果已有区域，后续点击替换最后一个点（让用户实时调整）
    this.setData({
      zoneBoundary: boundary,
    });
  },

  // 撤销最后一个顶点
  onUndoVertex() {
    const boundary = this.data.zoneBoundary.slice(0, -1);
    this.setData({ zoneBoundary: boundary });
  },

  // 清除所有顶点
  onClearBoundary() {
    wx.showModal({
      title: '清除区域',
      content: '确定清除已画的游戏区域？',
      success: (res) => {
        if (res.confirm) this.setData({ zoneBoundary: [] });
      }
    });
  },

  // 游戏时长滑块
  onDurationChange(e) {
    this.setData({ duration: e.detail.value });
  },

  // 查看次数滑块
  onPeekCountChange(e) {
    this.setData({ peekCount: e.detail.value });
  },

  // 保存配置
  onSave() {
    if (this.data.zoneBoundary.length < 3) {
      wx.showToast({ title: '至少画3个点形成区域', icon: 'none' });
      return;
    }

    // 通过 eventChannel 把配置传回 lobby 页
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.emit('onConfigSaved', {
      duration: this.data.duration,
      peekCount: this.data.peekCount,
      zoneBoundary: this.data.zoneBoundary,
    });

    wx.showToast({ title: '配置已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 800);
  },

  onReady() {
    // 获取当前位置作为地图中心
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          mapCenter: { lat: res.latitude, lng: res.longitude }
        });
      },
      fail: () => {
        // 使用默认位置
      }
    });
  },
});
