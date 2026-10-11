<script>
import { getServerUrl, getWsUrl } from './utils/config.js';
export default {
  globalData: {
    openId: '', nickName: '', avatarUrl: '',
    serverUrl: getServerUrl(), wsUrl: getWsUrl(),
  },
  onLaunch() {
    this.globalData.serverUrl = getServerUrl();
    this.globalData.wsUrl = getWsUrl();
    // 同步获取 openId：先从本地存储读，没有则生成并存入
    let id = uni.getStorageSync('catchcat_openId');
    if (!id) {
      // #ifdef MP-WEIXIN
      id = 'wx_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      // #endif
      // #ifdef APP-PLUS
      id = 'app_' + (uni.getSystemInfoSync().deviceId||'d').replace(/[^a-zA-Z0-9]/g,'').substring(0,16);
      // #endif
      // #ifdef H5
      id = 'h5_' + Date.now().toString(36);
      // #endif
      uni.setStorageSync('catchcat_openId', id);
    }
    this.globalData.openId = id;
  },
  methods: {
    getOpenId() { return this.globalData.openId || ('user_'+Date.now().toString(36)); },
    getNickName() { return this.globalData.nickName || '玩家'; },
    getAvatarUrl() { return this.globalData.avatarUrl || ''; },
  },
};
</script>

<style>
page {
  background-color: #FCF6E3;
  color: #4A3728;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
}
input::placeholder { color: #C4B8A8; }
button { margin:0; padding:0; line-height:1; }
button::after { border:none; }
</style>
