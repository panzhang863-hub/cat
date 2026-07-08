<template>
  <view class="container">
    <text class="title">📋 历史记录</text>
    <text class="count">共 {{ total }} 场游戏</text>

    <view v-if="records.length>0">
      <view class="card rec" v-for="item in records" :key="item.roomCode" @click="onTap(item)">
        <view class="rec-head">
          <text :class="['rec-res',item.winner===(item.myRole==='hider'?'hiders':'seekers')?'win':'lose']">{{ item.winner==='hiders'?'躲藏者胜':'寻找者胜' }}</text>
          <text class="rec-date">{{ fd(item.endedAt) }}</text>
        </view>
        <view class="rec-body">
          <text>⏱️ {{ fmt(item.duration) }}</text>
          <text>👥 {{ item.playerCount }}人</text>
          <text>🎭 {{ item.myRole==='seeker'?'寻找者':'躲藏者' }}</text>
        </view>
        <text :class="['rec-tag',item.myStatus]">{{ item.myStatus==='alive'?'存活':'淘汰' }}</text>
      </view>
    </view>

    <view class="empty" v-if="!loading&&records.length===0">
      <text class="e-icon">🎮</text>
      <text class="e-text">还没有玩过游戏</text>
    </view>
    <view class="lm" v-if="loading">加载中...</view>
    <view class="lm" v-if="noMore&&records.length>0">— 没有更多了 —</view>
  </view>
</template>

<script>
export default {
  data(){return{records:[],total:0,loading:false,noMore:false};},
  onLoad(){this.load();},
  onReachBottom(){this.load();},
  methods:{
    async load(){if(this.loading||this.noMore)return;this.loading=true;const a=getApp();try{const r=await uni.request({url:`${a.globalData.serverUrl}/api/history`,method:'GET',data:{openId:a.getOpenId(),limit:20,offset:this.records.length}});if(r.statusCode===200){this.records=[...this.records,...r.data.records];this.total=r.data.total;this.noMore=this.records.length>=r.data.total;}}catch(e){uni.showToast({title:'加载失败',icon:'none'});}finally{this.loading=false;}},
    onTap(i){uni.showToast({title:`详情: ${i.roomCode}`,icon:'none'});},
    fmt(s){if(!s)return'0:00';const m=Math.floor(s/60),sec=s%60;return`${m}:${String(sec).padStart(2,'0')}`;},
    fd(d){if(!d)return'';const dt=new Date(d);return`${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`;},
  },
};
</script>

<style scoped>
.container{padding:40rpx;min-height:100vh;}
.title{font-size:40rpx;font-weight:800;color:#4A3728;}
.count{font-size:24rpx;color:#C4B8A8;display:block;margin:6rpx 0 28rpx;}
.rec{position:relative;margin-bottom:18rpx;background:#FFFFFF;border-radius:20rpx;padding:28rpx;box-shadow:0 4rpx 16rpx rgba(0,0,0,0.03);}
.rec-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14rpx;}
.rec-res{font-size:26rpx;font-weight:700;padding:4rpx 14rpx;border-radius:6rpx;}
.rec-res.win{color:#FFA07A;background:rgba(255,160,122,0.08);}
.rec-res.lose{color:#C4B8A8;background:#F5F0E5;}
.rec-date{font-size:22rpx;color:#C4B8A8;}
.rec-body{display:flex;gap:28rpx;font-size:24rpx;color:#8B7E74;}
.rec-tag{position:absolute;top:28rpx;right:28rpx;font-size:20rpx;padding:4rpx 12rpx;border-radius:6rpx;}
.rec-tag.alive{background:rgba(46,204,113,0.08);color:#2ECC71;}
.rec-tag.eliminated{background:rgba(231,76,60,0.08);color:#E74C3C;}
.empty{display:flex;flex-direction:column;align-items:center;padding-top:140rpx;}
.e-icon{font-size:80rpx;margin-bottom:16rpx;}
.e-text{font-size:28rpx;color:#C4B8A8;}
.lm{text-align:center;font-size:24rpx;color:#C4B8A8;padding:32rpx 0;}
</style>
