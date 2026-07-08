<template>
<view :class="['page',flashAlert?'flash-alert':'']">
<view class="map-area"><map class="g-map" :latitude="mc.lat" :longitude="mc.lng" :scale="16" :show-location="true" :markers="markers" :polygons="polygons"></map></view>
<view class="panel">
<view class="panel-row">
<view :class="['tag',myRole]">{{ myRole==='seeker'?'🔍寻找者':'🙈逃跑者' }}</view>
<view :class="['timer',timeLeft<=60?'danger':'']">{{ timerText }}</view>
<view :class="['peek-btn',peekActive?'peek-active':'',peekLeft<=0?'peek-empty':'']" v-if="myRole==='seeker'" @tap="onPeek">
  <text v-if="peekActive">👀 查看中 {{peekExp}}s</text>
  <text v-else>🔍 查看 ({{peekLeft}})</text>
</view>
<view class="exit-dot" @tap="onExit">✕</view>
</view>

<!-- 抓捕弹窗 -->
<view class="cap-overlay" v-if="capTarget" @tap.stop="noop">
  <view class="cap-card">
    <text class="cap-alert">⚠️ 发现目标！</text>
    <text class="cap-player">🎯 {{capTarget.nickName}}</text>
    <text class="cap-dist">距离 {{capTarget.distance}} 米</text>
    <view class="cap-bar-bg">
      <view :class="['cap-bar-fill',capExp<=3?'urgent':'']" :style="{width:(capExp/10*100)+'%'}"></view>
    </view>
    <text class="cap-countdown">{{capExp}} 秒内确认</text>
    <view class="cap-row">
      <view class="btn-catch" @tap="onCap">🤚 抓住TA！</view>
      <view class="btn-pass" @tap="onCapNo">跳过</view>
    </view>
  </view>
</view>

<scroll-view class="log-scroll" scroll-y v-if="log.length"><view class="log-item" v-for="(l,i) in log" :key="i">{{l.m}}</view></scroll-view>
</view>
</view>
</template>

<script>
import { getGameSocket } from '../../utils/ws.js';
import { getGpsInterval } from '../../utils/config.js';
export default {
data(){return{
roomCode:'',myRole:'',alive:true,peekLeft:0,peekActive:false,peekExp:0,
mc:{lat:30.2741,lng:120.1551},polygons:[],timerText:'准备中...',timeLeft:0,
capTarget:null,capExp:0,log:[],ws:false,allPlayers:[],myId:'',markers:[],flashAlert:false
};},
onLoad(o){
this.roomCode=o.roomCode||'';this.myId=getApp().getOpenId();
this.loadState();this.timer=setInterval(()=>this.loadState(),2000);
const s=getGameSocket();s.connect(this.roomCode,this.myId);this.setupWS(s);
uni.setKeepScreenOn({keepScreenOn:true});this.startTrack();
},
onShow(){if(!getGameSocket().socketTask){getGameSocket().connect(this.roomCode,this.myId);}this.loadState();},
onUnload(){if(this.timer)clearInterval(this.timer);if(this._lt)clearInterval(this._lt);getGameSocket().disconnect();},
methods:{
noop(){},
buildMarkers(){
const peekOn=this.peekActive,isS=this.myRole==='seeker';
let list=this.allPlayers.filter(p=>p.status==='alive'||(peekOn&&p.role==='hider'));
if(!list.length){
this.markers=[{id:9999,latitude:this.mc.lat,longitude:this.mc.lng,width:28,height:28,callout:{content:'📍你',fontSize:14,borderRadius:8,padding:6,bgColor:'#FFA07A',color:'#fff',display:'ALWAYS'},anchor:{x:0.5,y:1}}];
return;
}
if(!peekOn)list=list.filter(p=>p.openId===this.myId||(isS?p.role==='seeker':p.role==='hider'));
const ms=list.map((p,i)=>{const nm=(p.openId===this.myId?'⭐':'')+(p.nickName||'?');return{id:i+1,latitude:p.lat||this.mc.lat+i*0.0003,longitude:p.lng||this.mc.lng+i*0.0003,width:20,height:20,title:(p.role==='seeker'?'🐱':'🐭')+' '+nm,callout:{content:nm,fontSize:12,borderRadius:8,padding:5,bgColor:p.openId===this.myId?'#FFE8D0':'#fff',color:'#333',display:'ALWAYS'},anchor:{x:0.5,y:1}};});
this.markers=ms;this.$forceUpdate();
},
loadState(){
const self=this,a=getApp();
uni.request({url:`${a.globalData.serverUrl}/api/game/${this.roomCode}/state`,method:'GET',success(r){
if(!r||r.statusCode!==200||!r.data)return;const g=r.data;
const me=g.players.find(p=>p.openId===self.myId);
if(me){self.myRole=me.role;self.peekLeft=me.peekRemaining||0;self.alive=me.status==='alive';}
if(g.config&&g.config.zoneBoundary&&g.config.zoneBoundary.length>=3)
self.polygons=[{points:g.config.zoneBoundary,fillColor:'#FFA07A20',strokeColor:'#FF6B35',strokeWidth:5}];
if(g.status==='playing'&&g.startedAt){
const dur=g.config?g.config.duration||900:900;
const el=Math.floor((Date.now()-new Date(g.startedAt).getTime())/1000);
self.timeLeft=Math.max(0,dur-el);const m=Math.floor(self.timeLeft/60),s=self.timeLeft%60;
self.timerText=m+':'+String(s).padStart(2,'0');
}else if(g.status==='ended'){self.timerText='结束';}else{self.timerText='准备中...';}
if(g.players){g.players.forEach(sp=>{if(!sp.status)sp.status='alive';if(!sp.role)sp.role='hider';const ep=self.allPlayers.find(p=>p.openId===sp.openId);if(ep){ep.role=sp.role;ep.status=sp.status;ep.peekRemaining=sp.peekRemaining;ep.nickName=sp.nickName||ep.nickName;}else{self.allPlayers.push(sp);}});}
self.buildMarkers();
}});
},
setupWS(s){this.ws=true;
s.on('positions_sync',d=>{if(d&&d.players){d.players.forEach(sp=>{const ep=this.allPlayers.find(q=>q.openId===sp.openId);if(ep){ep.lat=sp.lat;ep.lng=sp.lng;}});this.buildMarkers();}});
s.on('peek_result',d=>{this.peekActive=true;this.peekExp=d.expiresIn;this.peekLeft=d.remainingPeeks;uni.showToast({title:'发现'+(d.hiders||[]).length+'鼠鼠',icon:'none',duration:2000});if(d.hiders){d.hiders.forEach((h,i)=>{const lat=this.mc.lat+(i+1)*0.0005;const lng=this.mc.lng+(i+1)*0.0005;const ep=this.allPlayers.find(p=>p.openId===h.openId);if(ep){ep.lat=lat;ep.lng=lng;}else{this.allPlayers.push({openId:h.openId,nickName:h.nickName,lat:lat,lng:lng,role:'hider',status:'alive'});}});this.buildMarkers();}});
s.on('peek_expired',()=>{this.peekActive=false;this.peekExp=0;this.buildMarkers();});
s.on('capture_opportunity',d=>{
  this.capTarget=d.target;this.capExp=d.expiresIn;this.flashAlert=true;
  uni.vibrateShort({type:'heavy'});setTimeout(()=>uni.vibrateShort({type:'medium'}),300);setTimeout(()=>uni.vibrateShort({type:'medium'}),600);
  setTimeout(()=>this.flashAlert=false,1500);
});
s.on('player_eliminated',d=>{
  if(d.openId===this.myId){uni.vibrateLong({});}else{uni.vibrateShort({type:'medium'});}
  const t=d.reason==='out_of_bounds'?'越界淘汰':d.reason==='captured'?'被抓！':'淘汰';
  this.log.unshift({t:new Date().toLocaleTimeString(),m:(d.openId===this.myId?'你':'玩家')+t});
  this.log=this.log.slice(0,8);if(d.openId===this.myId)this.alive=false;
  const ep=this.allPlayers.find(p=>p.openId===d.openId);if(ep)ep.status='eliminated';this.buildMarkers();
});
s.on('player_quit',d=>{if(d&&d.nickName){this.log.unshift({t:new Date().toLocaleTimeString(),m:d.nickName+' 退出了游戏'});this.log=this.log.slice(0,8);uni.showToast({title:d.nickName+' 退出游戏',icon:'none',duration:2000});}});
s.on('game_ended',d=>{this.timerText='结束';setTimeout(()=>uni.redirectTo({url:`/pages/result/result?roomCode=${this.roomCode}&winner=${d.winner}&myRole=${this.myRole}&myStatus=${this.alive?'alive':'eliminated'}`}),2000);});
},
startTrack(){const s=getGameSocket();const base=getGpsInterval();const ivl=this.myRole==='hider'?Math.max(base,5000):base;this._lt=setInterval(()=>{uni.getLocation({type:'gcj02',success:r=>{this.mc={lat:r.latitude,lng:r.longitude};s.sendPosition(r.latitude,r.longitude);},fail:()=>{}});},ivl);},
onPeek(){if(this.myRole!=='seeker'){uni.showToast({title:'仅寻找者可查看',icon:'none'});return;}if(this.peekLeft<=0){uni.showToast({title:'无剩余次数',icon:'none'});return;}getGameSocket().usePeek();},
onExit(){const self=this;uni.showModal({title:'退出游戏',content:'确定退出回到首页？',success:r=>{if(r.confirm){getGameSocket().send('player_quit',{nickName:getApp().getNickName()||'玩家'});setTimeout(()=>{if(self.timer)clearInterval(self.timer);if(self._lt)clearInterval(self._lt);getGameSocket().disconnect();uni.reLaunch({url:'/pages/index/index'});},300);}}});},
onCap(){getGameSocket().confirmCapture(this.capTarget.openId);this.capTarget=null;uni.vibrateShort({type:'heavy'});uni.showToast({title:'已抓捕',icon:'success'});},
onCapNo(){this.capTarget=null;},
}
};
</script>

<style scoped>
.page{width:100vw;height:100vh;display:flex;flex-direction:column;background:#FCF6E3;}
.flash-alert{animation:flashBg 0.5s ease-in-out 3;}
@keyframes flashBg{0%,100%{background:#FCF6E3}50%{background:#FFE0D0}}
.map-area{flex:1;width:100%;min-height:0;}
.g-map{width:100%;height:100%;}
.panel{flex-shrink:0;padding:16rpx 24rpx 32rpx;background:#FFF;}
.panel-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10rpx;}
.exit-dot{width:48rpx;height:48rpx;border-radius:50%;background:#F5F0E5;color:#8B7E74;font-size:22rpx;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tag{padding:6rpx 18rpx;border-radius:10rpx;font-size:22rpx;font-weight:700;}
.tag.seeker{background:rgba(255,160,122,0.85);color:#fff;}
.tag.hider{background:rgba(46,204,113,0.85);color:#fff;}
.timer{font-size:42rpx;font-weight:900;font-family:monospace;color:#4A3728;}
.timer.danger{color:#E74C3C;}

/* Peek 按钮 */
.peek-btn{background:#FF6B35;color:#fff;padding:14rpx 22rpx;border-radius:14rpx;font-size:24rpx;font-weight:700;box-shadow:0 4rpx 16rpx rgba(255,107,53,0.35);transition:all 0.2s;}
.peek-btn:active{transform:scale(0.95);}
.peek-btn.peek-active{background:#2ECC71;box-shadow:0 0 24rpx rgba(46,204,113,0.5);animation:peekPulse 1s ease-in-out infinite;}
.peek-btn.peek-empty{background:#C4B8A8;box-shadow:none;}
@keyframes peekPulse{0%,100%{box-shadow:0 0 16rpx rgba(46,204,113,0.4)}50%{box-shadow:0 0 32rpx rgba(46,204,113,0.7)}}

/* 抓捕弹窗 */
.cap-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s;}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.cap-card{background:#FFF;border-radius:28rpx;padding:40rpx 32rpx;width:560rpx;text-align:center;box-shadow:0 16rpx 60rpx rgba(0,0,0,0.2);animation:capBounce 0.3s ease-out;}
@keyframes capBounce{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}}
.cap-alert{font-size:36rpx;font-weight:900;color:#E74C3C;display:block;margin-bottom:8rpx;}
.cap-player{font-size:42rpx;font-weight:800;color:#4A3728;display:block;margin-bottom:8rpx;}
.cap-dist{font-size:28rpx;color:#8B7E74;display:block;margin-bottom:20rpx;}
.cap-bar-bg{width:100%;height:12rpx;background:#F5F0E5;border-radius:6rpx;overflow:hidden;margin-bottom:10rpx;}
.cap-bar-fill{height:100%;background:#FF6B35;border-radius:6rpx;transition:width 0.3s;}
.cap-bar-fill.urgent{background:#E74C3C;animation:barPulse 0.5s ease-in-out infinite;}
@keyframes barPulse{0%,100%{opacity:1}50%{opacity:0.5}}
.cap-countdown{font-size:22rpx;color:#C4B8A8;display:block;margin-bottom:24rpx;}
.cap-row{display:flex;gap:16rpx;}
.btn-catch{flex:2;background:linear-gradient(135deg,#E74C3C,#C0392B);color:#fff;border-radius:40rpx;padding:18rpx;font-size:28rpx;font-weight:800;text-align:center;box-shadow:0 6rpx 20rpx rgba(231,76,60,0.35);}
.btn-catch:active{transform:scale(0.96);}
.btn-pass{flex:1;background:#F5F0E5;color:#8B7E74;border-radius:40rpx;padding:18rpx;font-size:26rpx;text-align:center;}

/* 日志 */
.log-scroll{max-height:120rpx;margin-top:8rpx;}
.log-item{font-size:22rpx;color:rgba(0,0,0,0.45);padding:2rpx 0;}
</style>
