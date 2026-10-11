<template>
  <view class="container">
    <!-- 背景音乐开关 -->
    <view class="music-btn" :class="bgmOn?'':'music-off'" @click="onToggleBgm">
      <text>{{ bgmOn ? '🎵' : '🔇' }}</text>
    </view>

    <!-- 猫咪插画 -->
    <view class="hero">
      <view class="cat-wrap">
        <view class="watercolor-glow"></view>
        <image class="cat-img" src="/static/cat-head.png" mode="aspectFit"></image>
        <view class="hi-bubble"><text class="hi-text">hi ~</text></view>
      </view>
      <text class="title">抓猫猫</text>
      <text class="sub">现实世界捉迷藏 · GPS 追捕对战</text>
      <text class="how-link" @click="showGuide=true">🐾 怎么玩</text>
    </view>

    <!-- 新手引导弹窗 -->
    <view class="guide-mask" v-if="showGuide" @click="showGuide=false">
      <view class="guide-card" @click.stop>
        <text class="g-title">🐱 怎么玩</text>
        <view class="g-step" v-for="(s,i) in steps" :key="i">
          <text class="gs-num">{{i+1}}</text>
          <view class="gs-body">
            <text class="gs-title">{{s.title}}</text>
            <text class="gs-desc">{{s.desc}}</text>
          </view>
        </view>
        <view class="g-btn" @click="showGuide=false">知道了，开玩！</view>
      </view>
    </view>

    <!-- 昵称输入 -->
    <view class="card nick-card">
      <view class="nick-label">昵称输入</view>
      <input class="input-box" placeholder="点击输入昵称" :value="nickName" @input="onNickInput" maxlength="8"/>
    </view>

    <!-- 加入房间 -->
    <view class="card join-card">
      <input class="input-box" placeholder="输入 6 位房间码" maxlength="6" v-model="roomCode" />
      <button class="btn-main btn-small" @click="onJoinRoom">进入房间</button>
    </view>

    <text class="divider">或者</text>

    <!-- 创建房间 -->
    <button class="btn-main btn-wide" @click="onCreateRoom">🎮  创建新房间</button>

    <text class="history-link" @click="onViewHistory">🐾 历史对战记录</text>

    <view class="settings-panel" v-if="showSettings">
      <view class="settings-mask" @click="showSettings=false"></view>
      <view class="settings-card">
        <text class="stitle">服务器地址</text>
        <input class="sinput" :value="serverUrl" @input="e=>serverUrl=e.detail.value" placeholder="http://localhost:3000"/>
        <view class="sbtns">
          <view class="sbtn-cancel" @click="showSettings=false">取消</view>
          <view class="sbtn-save" @click="onSaveServer">保存</view>
        </view>
      </view>
    </view>

    <view class="bottom-row">
      <text class="version" @click="onVersionTap">v1.0.0</text>
      <text class="feedback-link" @click="onFeedback">优化建议</text>
    </view>

    <!-- 反馈弹窗 -->
    <view class="guide-mask" v-if="showFeedback" @click="showFeedback=false">
      <view class="guide-card" @click.stop>
        <text class="g-title">优化建议</text>
        <textarea class="f-input" v-model="feedbackText" placeholder="说说你想优化的地方..." maxlength="500"/>
        <view class="g-btn" @click="onSubmitFeedback">提交</view>
      </view>
    </view>
  </view>
</template>

<script>
import { getServerUrl, setServerUrl } from '../../utils/config.js';
import { playBgm, toggleBgm, isBgmOn } from '../../utils/audio.js';
export default {
  data() { return { roomCode: '', nickName: '', showSettings: false, serverUrl: '', showGuide: false, showFeedback: false, feedbackText: '', versionTaps: 0, bgmOn:true,
    steps:[
      {title:'创建房间',desc:'点击「创建新房间」，你会成为房主🐱。把6位房间码分享给朋友'},
      {title:'选择阵营',desc:'猫猫负责抓人🙈，鼠鼠负责躲藏🐭。选你喜欢的阵营吧！'},
      {title:'开始游戏',desc:'房主在地图上画好区域后开始。猫猫用「查看」发现鼠鼠，靠近后抓捕！'},
    ]
  }; },
  onLoad(o) { const a=getApp(); const n=a.globalData.nickName; this.nickName=(n&&n!=='玩家')?n:(uni.getStorageSync('nickName')||''); this.serverUrl=getServerUrl(); if(o&&o.room){this.roomCode=o.room;} },
  onShow() { this.bgmOn = isBgmOn(); playBgm(); },
  onShareAppMessage() { return { title: '猫猫快追 - 现实世界捉迷藏，快来一起玩！', path: '/pages/index/index' }; },
  onShareTimeline() { return { title: '猫猫快追 - 现实世界捉迷藏，快来一起玩！' }; },
  methods: {
    onNickInput(e){this.nickName=e.detail.value;if(e.detail.value)uni.setStorageSync('nickName',e.detail.value);},
    onVersionTap(){this.versionTaps++;if(this.versionTaps>=5){this.versionTaps=0;this.serverUrl=getServerUrl();this.showSettings=true;}},
    onSaveServer(){
      if(!this.serverUrl||!this.serverUrl.startsWith('http')){uni.showToast({title:'请输入正确的地址',icon:'none'});return;}
      setServerUrl(this.serverUrl);
      getApp().globalData.serverUrl=getServerUrl();
      getApp().globalData.wsUrl=getServerUrl().replace('http','ws');
      this.showSettings=false;
      uni.showToast({title:'已保存，重启生效',icon:'success'});
    },
    onCreateRoom() {
      if(!this.nickName){uni.showToast({title:'请先设置昵称',icon:'none'});return;}
      const a=getApp();
      a.globalData.nickName=this.nickName;
      uni.request({
        url:`${a.globalData.serverUrl}/api/room/create`,method:'POST',
        data:{openId:a.getOpenId(),nickName:this.nickName,avatarUrl:a.getAvatarUrl()},
        success:(r)=>{
          if(r.statusCode===200&&r.data&&r.data.roomCode){
            const pl=encodeURIComponent(JSON.stringify(r.data.players||[]));
            uni.navigateTo({url:`/pages/lobby/lobby?roomCode=${r.data.roomCode}&isHost=1&nick=${encodeURIComponent(this.nickName)}&players=${pl}`});
          } else {
            uni.showToast({title:(r.data&&r.data.error)||'创建失败',icon:'none'});
          }
        },
        fail:(e)=>{uni.showToast({title:'无法连接服务器',icon:'none'});}
      });
    },
    onJoinRoom() {
      if(!this.roomCode||this.roomCode.length!==6){uni.showToast({title:'请输入6位房间码',icon:'none'});return;}
      if(!this.nickName){uni.showToast({title:'请先设置昵称',icon:'none'});return;}
      const a=getApp();
      a.globalData.nickName=this.nickName;
      uni.request({
        url:`${a.globalData.serverUrl}/api/room/join`,method:'POST',
        data:{roomCode:this.roomCode,openId:a.getOpenId(),nickName:this.nickName,avatarUrl:a.getAvatarUrl()},
        success:(r)=>{
          if(r.statusCode===200){
            const pl=encodeURIComponent(JSON.stringify(r.data.players||[]));
            uni.navigateTo({url:`/pages/lobby/lobby?roomCode=${this.roomCode}&isHost=0&nick=${encodeURIComponent(this.nickName)}&players=${pl}`});
          } else {
            uni.showToast({title:(r.data&&r.data.error)||'加入失败',icon:'none'});
          }
        },
        fail:(e)=>{uni.showToast({title:'无法连接服务器',icon:'none'});}
      });
    },
    onFeedback(){this.showFeedback=true;this.feedbackText='';},
    onSubmitFeedback(){
      if(!this.feedbackText.trim()){uni.showToast({title:'请写点什么',icon:'none'});return;}
      const a=getApp();
      uni.request({url:`${a.globalData.serverUrl}/api/feedback`,method:'POST',data:{openId:a.getOpenId(),nickName:a.getNickName(),text:this.feedbackText},success:()=>{this.showFeedback=false;uni.showToast({title:'收到！谢谢反馈',icon:'success'});},fail:()=>uni.showToast({title:'提交失败',icon:'none'})});
    },
    onViewHistory() { uni.navigateTo({url:'/pages/history/history'}); },
    onToggleBgm() { this.bgmOn = toggleBgm(); },
  },
};
</script>

<style scoped>
.container { display:flex; flex-direction:column; align-items:center; padding:40rpx 48rpx 60rpx; min-height:100vh; }
.music-btn { position:fixed; top:24rpx; right:24rpx; width:64rpx; height:64rpx; border-radius:50%; background:rgba(255,255,255,0.92); display:flex; align-items:center; justify-content:center; font-size:32rpx; box-shadow:0 2rpx 10rpx rgba(0,0,0,0.08); z-index:50; }
.music-btn.music-off { opacity:0.55; }

/* ── 猫咪插画 ── */
.hero { text-align:center; margin-bottom:28rpx; }
.cat-wrap { position:relative; display:inline-block; width:460rpx; height:300rpx; margin-bottom:0; }
@keyframes catFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10rpx)} }

.watercolor-glow {
  position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
  width:400rpx; height:300rpx;
  background:radial-gradient(ellipse,rgba(255,200,165,0.22) 0%,rgba(255,220,185,0.08) 45%,transparent 70%);
  border-radius:50%; pointer-events:none;
}

.cat-img {
  width:100%; height:100%;
  position:relative; z-index:1;
  mix-blend-mode: darken;
}

/* hi 气泡 */
.hi-bubble {
  position:absolute; top:10rpx; right:-10rpx;
  background:#FFF; border-radius:20rpx;
  padding:10rpx 24rpx;
  box-shadow:0 3rpx 14rpx rgba(0,0,0,0.06);
  z-index:5;
  animation:bubbleBounce 2.5s ease-in-out infinite;
}
@keyframes bubbleBounce {
  0%,100%{transform:translateY(0) scale(1)}
  60%{transform:translateY(-10rpx) scale(1.04)}
}
.hi-bubble::after {
  content:''; position:absolute; bottom:-10rpx; left:20rpx;
  width:0; height:0;
  border-left:10rpx solid transparent;
  border-right:10rpx solid transparent;
  border-top:12rpx solid #FFF;
}
.hi-text { font-size:26rpx; font-weight:700; color:#FFA07A; }

.title { font-size:58rpx; font-weight:800; color:#FFA07A; display:block; margin-bottom:10rpx; letter-spacing:10rpx; font-family:cursive; }
.sub { font-size:26rpx; color:#B8A898; display:block; }

/* 昵称卡片 */
.nick-card { padding:20rpx 28rpx !important; background:#FAF7F0 !important; }
.nick-label { font-size:24rpx; color:#C4B8A8; text-align:center; }

/* 通用卡片 */
.card { background:#FFFFFF; border-radius:24rpx; padding:32rpx 28rpx; width:100%; max-width:460rpx; box-shadow:0 4rpx 20rpx rgba(0,0,0,0.04); display:flex; flex-direction:column; gap:16rpx; }

/* 加入房间卡片 */
.join-card { padding:24rpx 28rpx !important; }

/* 输入框 */
.input-box { background:#FAF7F0; border-radius:14rpx; padding:18rpx 20rpx; color:#4A3728; font-size:30rpx; text-align:center; letter-spacing:6rpx; font-weight:600; border:1rpx solid #F0EBE0; box-shadow:0 2rpx 8rpx rgba(0,0,0,0.03); }

/* 按钮 */
.btn-main { background:linear-gradient(135deg,#FFDD75,#FFC850); color:#4A3728; border:none; border-radius:40rpx; padding:18rpx 48rpx; font-size:28rpx; font-weight:700; box-shadow:0 4rpx 16rpx rgba(255,200,80,0.25); display:inline-flex; align-items:center; justify-content:center; }
.btn-main:active { opacity:0.8; transform:scale(0.97); }
.btn-small { padding:14rpx 40rpx !important; font-size:26rpx !important; }
.btn-wide { width:100%; max-width:460rpx; }

/* 分割 */
.divider { font-size:26rpx; color:#C4B8A8; margin:22rpx 0; }

/* 历史 */
.history-link { margin-top:56rpx; font-size:26rpx; color:#C4B8A8; padding:16rpx; }

.settings-mask { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.3); z-index:100; }
.settings-card { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#fff; border-radius:24rpx; padding:40rpx; width:560rpx; z-index:101; box-shadow:0 8rpx 40rpx rgba(0,0,0,0.12); }
.stitle { font-size:32rpx; font-weight:700; color:#4A3728; display:block; margin-bottom:20rpx; }
.sinput { background:#FAF7F0; border-radius:14rpx; padding:18rpx 20rpx; font-size:28rpx; color:#4A3728; border:1rpx solid #F0EBE0; margin-bottom:24rpx; }
.sbtns { display:flex; gap:16rpx; }
.sbtn-cancel { flex:1; text-align:center; padding:16rpx; border-radius:40rpx; background:#F5F0E5; color:#8B7E74; font-size:28rpx; }
.sbtn-save { flex:1; text-align:center; padding:16rpx; border-radius:40rpx; background:linear-gradient(135deg,#FFDD75,#FFC850); color:#4A3728; font-size:28rpx; font-weight:700; }

/* 怎么玩 */
.how-link { font-size:24rpx; color:#FFA07A; padding:8rpx 20rpx; margin-top:8rpx; display:inline-block; }
.guide-mask { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.4); z-index:200; display:flex; align-items:center; justify-content:center; }
.guide-card { background:#fff; border-radius:28rpx; padding:40rpx 36rpx; width:580rpx; max-height:80vh; overflow-y:auto; }
.g-title { font-size:38rpx; font-weight:800; color:#4A3728; text-align:center; display:block; margin-bottom:32rpx; }
.g-step { display:flex; align-items:flex-start; margin-bottom:28rpx; }
.gs-num { width:48rpx; height:48rpx; border-radius:50%; background:#FFA07A; color:#fff; font-size:26rpx; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-right:20rpx; }
.gs-title { font-size:28rpx; font-weight:700; color:#4A3728; display:block; margin-bottom:6rpx; }
.gs-desc { font-size:24rpx; color:#8B7E74; line-height:1.5; }
.g-btn { background:linear-gradient(135deg,#FFDD75,#FFC850); color:#4A3728; border-radius:40rpx; padding:18rpx; font-size:28rpx; font-weight:700; text-align:center; margin-top:16rpx; }

/* 版本号 */
.bottom-row { display:flex; justify-content:center; align-items:center; gap:20rpx; margin-top:20rpx; }
.version { font-size:20rpx; color:#D8D0C8; }
.feedback-link { font-size:20rpx; color:#D8D0C8; }
.f-input { width:100%; height:200rpx; background:#FAF7F0; border-radius:14rpx; padding:20rpx; font-size:28rpx; color:#4A3728; border:1rpx solid #F0EBE0; margin-bottom:20rpx; box-sizing:border-box; }
</style>
