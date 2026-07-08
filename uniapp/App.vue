<script>
import { getServerUrl, getWsUrl } from './utils/config.js';
export default {
  globalData: {
    openId: '', nickName: '', avatarUrl: '',
    serverUrl: getServerUrl(), wsUrl: getWsUrl(),
  },
  onLaunch() {
    // 每次启动刷新配置
    this.globalData.serverUrl = getServerUrl();
    this.globalData.wsUrl = getWsUrl();
    // #ifdef MP-WEIXIN
    uni.login({ success: r => { if(r.code) this.globalData.openId = 'wx_' + r.code.substring(0,8); }});
    // #endif
    // #ifdef APP-PLUS
    this.globalData.openId = 'app_' + (uni.getSystemInfoSync().deviceId||'d').replace(/[^a-zA-Z0-9]/g,'').substring(0,16);
    // #endif
    // #ifdef H5
    this.globalData.openId = 'h5_' + Date.now().toString(36);
    // #endif
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
