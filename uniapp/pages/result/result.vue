<template>
  <view class="container">
    <view class="hero">
      <text class="r-face">{{ isWin ? '😸' : '😿' }}</text>
      <text :class="['r-title',isWin?'win':'lose']">{{ isWin ? '你赢了！' : '你输了' }}</text>
      <text class="r-sub">{{ winner==='hiders'?'逃跑者方获胜':'寻找者方获胜' }}</text>
    </view>
    <view class="card" v-if="gameDetail">
      <view class="row"><text>🎭 你的角色</text><text class="val">{{ myRole==='seeker'?'寻找者':'逃跑者' }}</text></view>
      <view class="row"><text>⏱️ 游戏用时</text><text class="val">{{ fmt(gameDetail.duration) }}</text></view>
      <view class="row"><text>👥 参与人数</text><text class="val">{{ gameDetail.playerCount }} 人</text></view>
      <view class="row"><text>🕐 开始时间</text><text class="val">{{ fd(gameDetail.startedAt) }}</text></view>
    </view>
    <button class="btn-main" @click="onAgain">🔄 再来一局</button>
    <text class="link" @click="onHistory">🐾 查看历史</text>
  </view>
</template>

<script>
export default {
  data(){return{roomCode:'',winner:'',myRole:'',myStatus:'',isWin:false,gameDetail:null};},
  onLoad(o){this.roomCode=o.roomCode||'';this.winner=o.winner||'';this.myRole=o.myRole||'';this.myStatus=o.myStatus||'';this.isWin=(this.winner==='hiders'&&this.myRole==='hider'&&this.myStatus==='alive')||(this.winner==='seekers'&&this.myRole==='seeker');this.fetch();},
  methods:{
    async fetch(){try{const r=await uni.request({url:`${getApp().globalData.serverUrl}/api/history/${this.roomCode}`,method:'GET'});if(r.statusCode===200)this.gameDetail=r.data;}catch(e){}},
    onAgain(){const me=getApp();uni.redirectTo({url:`/pages/lobby/lobby?roomCode=${this.roomCode}&nick=${encodeURIComponent(me.getNickName()||'')}`});},
    onHistory(){uni.redirectTo({url:'/pages/history/history'});},
    fmt(s){if(!s)return'0:00';const m=Math.floor(s/60),sec=s%60;return`${m}:${String(sec).padStart(2,'0')}`;},
    fd(d){if(!d)return'';const dt=new Date(d);return`${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`;},
  },
};
</script>

<style scoped>
.container{display:flex;flex-direction:column;align-items:center;padding:80rpx 40rpx 40rpx;min-height:100vh;}
.hero{text-align:center;margin-bottom:40rpx;}
.r-cat{width:160rpx;height:160rpx;border-radius:50%;display:block;margin:0 auto;}
.r-face{font-size:60rpx;display:block;margin-top:-30rpx;}
.r-title{font-size:52rpx;font-weight:900;display:block;margin:16rpx 0 8rpx;}
.r-title.win{color:#FFA07A;}
.r-title.lose{color:#C4B8A8;}
.r-sub{font-size:26rpx;color:#B8A898;}
.card{background:#FFFFFF;border-radius:24rpx;padding:28rpx;width:100%;max-width:500rpx;margin-bottom:40rpx;box-shadow:0 4rpx 20rpx rgba(0,0,0,0.03);}
.row{display:flex;justify-content:space-between;padding:18rpx 0;font-size:28rpx;border-bottom:1rpx solid #F5F0E5;}
.val{color:#FFA07A;font-weight:700;}
.btn-main{background:linear-gradient(135deg,#FFDD75,#FFC850);color:#4A3728;border:none;border-radius:40rpx;padding:18rpx 56rpx;font-size:30rpx;font-weight:700;width:100%;max-width:500rpx;margin-bottom:16rpx;box-shadow:0 4rpx 16rpx rgba(255,200,80,0.25);}
.link{font-size:26rpx;color:#C4B8A8;padding:16rpx;}
</style>
