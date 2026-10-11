<template>
<view :class="['page',flashAlert?'flash-alert':'']">

  <!-- 全屏地图 -->
  <view class="map-area">
    <map id="gameMap" class="g-map"
      :latitude="center.lat" :longitude="center.lng" :scale="scale"
      :show-location="true" :show-compass="true" :enable-rotate="true" :show-scale="true"
      :markers="markers" :polygons="polygons"
      @regionchange="onRegionChange"></map>
  </view>

  <!-- ⚠️ 微信 map 是原生组件，盖在地图上的元素必须用 cover-view，否则会被地图挡住 -->

  <!-- 顶部：状态条 + 退出 -->
  <cover-view class="top-row" :style="'margin-top:'+(statusBarH+8)+'px'">
    <cover-view class="top-bar">
      <cover-view :class="['role-tag',myRole]">
        <cover-image class="role-avatar" :src="myRole==='seeker'?'/static/avatar-cat.png':'/static/avatar-mouse.png'"></cover-image>
        <cover-view class="role-text">{{ myRole==='seeker'?'寻找者':'躲藏者' }}</cover-view>
      </cover-view>
      <cover-view class="timer-wrap">
        <cover-view :class="['timer',timeLeft<=60&&timeLeft>0?'danger':'']">{{ timerText }}</cover-view>
        <cover-view class="timer-bar"><cover-view class="timer-bar-fill" :style="{width:timePct+'%'}"></cover-view></cover-view>
      </cover-view>
      <cover-view class="alive-wrap">
        <cover-view class="alive-item">
          <cover-image class="alive-avatar" src="/static/avatar-cat.png"></cover-image>
          <cover-view class="alive-num">{{ aliveSeekers }}/{{ totalSeekers }}</cover-view>
        </cover-view>
        <cover-view class="alive-item">
          <cover-image class="alive-avatar" src="/static/avatar-mouse.png"></cover-image>
          <cover-view class="alive-num">{{ aliveHiders }}/{{ totalHiders }}</cover-view>
        </cover-view>
      </cover-view>
    </cover-view>
    <cover-view class="exit-btn" @tap="onExit">✕</cover-view>
  </cover-view>

  <!-- 地图控件 -->
  <cover-view class="map-controls">
    <cover-view :class="['ctrl-btn',offCenter?'ctrl-alert':'']" @tap="recenter">📍</cover-view>
    <cover-view class="ctrl-btn" @tap="zoomIn">＋</cover-view>
    <cover-view class="ctrl-btn" @tap="zoomOut">－</cover-view>
  </cover-view>

  <!-- 边界预警 -->
  <cover-view class="chip-row boundary-chip-row" v-if="boundaryDist>=0">
    <cover-view :class="['boundary-chip',boundaryDist<30?'boundary-urgent':'']">📍 距边界 {{ boundaryDist }}m</cover-view>
  </cover-view>

  <!-- peek 距离读数 -->
  <cover-view class="chip-row nearest-chip-row" v-if="nearestHider!=null">
    <cover-view class="nearest-chip">🎯 最近鼠鼠 {{ nearestHider }}m</cover-view>
  </cover-view>

  <!-- Peek 按钮 -->
  <cover-view class="chip-row peek-btn-row" v-if="myRole==='seeker'">
    <cover-view :class="['peek-btn',peekActive?'peek-active':'',peekLeft<=0?'peek-empty':'']" @tap="onPeek">
      <cover-view v-if="peekActive">👀 查看中 {{peekExp}}s</cover-view>
      <cover-view v-else>🔍 查看 ({{peekLeft}})</cover-view>
    </cover-view>
  </cover-view>

  <!-- 日志 -->
  <cover-view class="log-scroll" v-if="logVisible&&log.length">
    <cover-view class="log-item" v-for="(l,i) in log" :key="i">{{l.m}}</cover-view>
  </cover-view>

  <!-- 抓捕弹窗 -->
  <cover-view class="cap-overlay" v-if="capTarget" @tap.stop="noop">
    <cover-view class="cap-card">
      <cover-view class="cap-alert">⚠️ 发现目标！</cover-view>
      <cover-view class="cap-player">🎯 {{capTarget.nickName}}</cover-view>
      <cover-view class="cap-dist">距离 {{capTarget.distance}} 米</cover-view>
      <cover-view class="cap-bar-bg">
        <cover-view :class="['cap-bar-fill',capExp<=3?'urgent':'']" :style="{width:(capExp/10*100)+'%'}"></cover-view>
      </cover-view>
      <cover-view class="cap-countdown">{{capExp}} 秒内确认</cover-view>
      <cover-view class="cap-row">
        <cover-view class="btn-catch" @tap="onCap">🤚 抓住TA！</cover-view>
        <cover-view class="btn-pass" @tap="onCapNo">跳过</cover-view>
      </cover-view>
    </cover-view>
  </cover-view>

</view>
</template>

<script>
import { getGameSocket } from '../../utils/ws.js';
import { getGpsInterval } from '../../utils/config.js';
export default {
data(){return{
roomCode:'',myRole:'',alive:true,peekLeft:0,peekActive:false,peekExp:0,
mc:{lat:30.2741,lng:120.1551},center:{lat:30.2741,lng:120.1551},zonePoints:[],timerText:'准备中...',timeLeft:0,totalDur:0,
capTarget:null,capExp:0,log:[],ws:false,allPlayers:[],myId:'',markers:[],flashAlert:false,
scale:16,mapCtx:null,statusBarH:20,offCenter:false,logVisible:false,logTimer:null,
animPos:{},markerIds:{},nextMarkerId:1,animTimer:null,animActive:false,
glowPhase:0,glowTimer:null
};},
	computed:{
	aliveSeekers(){return this.allPlayers.filter(p=>p.role==='seeker'&&p.status!=='eliminated').length;},
	totalSeekers(){return this.allPlayers.filter(p=>p.role==='seeker').length||(this.myRole==='seeker'?1:0);},
	aliveHiders(){return this.allPlayers.filter(p=>p.role==='hider'&&p.status!=='eliminated').length;},
	totalHiders(){return this.allPlayers.filter(p=>p.role==='hider').length||(this.myRole==='hider'?1:0);},
	timePct(){if(!this.totalDur)return 0;return Math.min(100,Math.max(0,this.timeLeft/this.totalDur*100));},
	boundaryDist(){
	  if(!this.zonePoints||this.zonePoints.length<3)return -1;
	  let min=Infinity;
	  for(let i=0;i<this.zonePoints.length;i++){const d=this._distHav(this.mc,this.zonePoints[i]);if(d<min)min=d;}
	  return Math.round(min);
	},
	polygons(){
	  if(!this.zonePoints||this.zonePoints.length<3)return [];
	  const near=this.boundaryDist>=0&&this.boundaryDist<30;
	  const b=0.5+0.5*Math.sin(this.glowPhase*Math.PI*2); // 0..1 呼吸微光
	  const c=near?[231,76,60]:[255,150,100];   // 越界预警红 / 暖橙
	  const fillA=Math.round(22+b*18);          // 填充透明度呼吸 22~40
	  // 关键：zoneBoundary 存的是 {lat,lng}，微信地图 polygons 要 {latitude,longitude}
	  const pts=this.zonePoints.map(p=>({latitude:p.lat,longitude:p.lng}));
	  return [{points:pts,fillColor:this._rgba(c[0],c[1],c[2],fillA),strokeColor:near?'#E74C3C':'#FF6B35',strokeWidth:near?4:3}];
	},
	nearestHider(){
	  if(this.myRole!=='seeker'||!this.peekActive)return null;
	  let min=Infinity;
	  for(const p of this.allPlayers){
	    if(p.role==='hider'&&p.status==='alive'&&p.lat!=null&&p.lng!=null){
	      const d=this._distHav(this.mc,{lat:p.lat,lng:p.lng});
	      if(d<min)min=d;
	    }
	  }
	  return min===Infinity?null:Math.round(min);
	}
	},
onLoad(o){
this.roomCode=o.roomCode||'';this.myId=getApp().getOpenId();
try{this.statusBarH=uni.getSystemInfoSync().statusBarHeight||20;}catch(e){}
this.mapCtx=uni.createMapContext('gameMap',this);
this.loadState();this.timer=setInterval(()=>this.loadState(),2000);
const s=getGameSocket();s.connect(this.roomCode,this.myId);this.setupWS(s);
uni.setKeepScreenOn({keepScreenOn:true});this.startTrack();
this.glowTimer=setInterval(()=>{if(this.zonePoints&&this.zonePoints.length>=3)this.glowPhase=(this.glowPhase+0.03)%1;},150);
},
onShow(){if(!getGameSocket().socketTask){getGameSocket().connect(this.roomCode,this.myId);}this.loadState();},
onUnload(){if(this.timer)clearInterval(this.timer);if(this._lt)clearInterval(this._lt);if(this.logTimer)clearTimeout(this.logTimer);if(this.animTimer)clearInterval(this.animTimer);if(this.glowTimer)clearInterval(this.glowTimer);getGameSocket().disconnect();},
methods:{
noop(){},
	_setTarget(id,lat,lng){
		if(lat==null||lng==null)return;
		const a=this.animPos[id];
		if(!a){this.animPos[id]={lat:lat,lng:lng,fromLat:lat,fromLng:lng,toLat:lat,toLng:lng,start:Date.now(),dur:0};return;}
		// 目标没变（静止广播）→ 直接吸附，不启动动画
		if(Math.abs(a.toLat-lat)<1e-7&&Math.abs(a.toLng-lng)<1e-7){a.lat=lat;a.lng=lng;return;}
		a.fromLat=a.lat;a.fromLng=a.lng;
		a.toLat=lat;a.toLng=lng;
		a.start=Date.now();a.dur=2200; // 2.2s 平滑过渡，略快于上报间隔(3s)以免排队
		this.animActive=true;
		if(!this.animTimer)this._startAnim();
	},
	_startAnim(){if(this.animTimer)return;this.animTimer=setInterval(()=>this._tickAnim(),100);},
	_stopAnim(){if(this.animTimer){clearInterval(this.animTimer);this.animTimer=null;}},
	_tickAnim(){
		if(!this.animActive)return;
		const now=Date.now();let anyActive=false;
		for(const id in this.animPos){
			const a=this.animPos[id];
			if(!a.dur)continue;
			const p=Math.min(1,(now-a.start)/a.dur);
			a.lat=a.fromLat+(a.toLat-a.fromLat)*p;
			a.lng=a.fromLng+(a.toLng-a.fromLng)*p;
			if(p<1)anyActive=true;else a.dur=0;
		}
		this.buildMarkers();
		if(!anyActive){this.animActive=false;this._stopAnim();}
	},
buildMarkers(){
	const peekOn=this.peekActive,isS=this.myRole==='seeker';
	const ms=[];
	this.allPlayers.forEach(p=>{
		if(p.openId===this.myId)return;          // 自己 = 原生蓝点
		if(p.status==='eliminated')return;
		const ap=this.animPos[p.openId];
		const lat=ap?ap.lat:p.lat;
		const lng=ap?ap.lng:p.lng;
		if(lat==null||lng==null)return;
		const isHider=p.role==='hider';
		const show=isS?(!isHider||peekOn):true;   // 寻找者看不到鼠鼠(除非peek)，鼠鼠能一直看到猫猫
		if(!show)return;
		let id=this.markerIds[p.openId];         // 稳定 id，避免每次重建导致地图闪烁
		if(!id){id=this.nextMarkerId++;this.markerIds[p.openId]=id;}
		ms.push({
			id:id,latitude:lat,longitude:lng,
			iconPath:isHider?'/static/avatar-mouse.png':'/static/avatar-cat.png',
			width:40,height:40,
			anchor:{x:0.5,y:1},
			label:{content:p.nickName||'',fontSize:11,color:'#4A3728',bgColor:'#FFFFFF',borderRadius:8,padding:3,textAlign:'center',anchorX:0,anchorY:4}
		});
	});
	this.markers=ms;this.$forceUpdate();
	},
loadState(){
const self=this,a=getApp();
uni.request({url:`${a.globalData.serverUrl}/api/game/${this.roomCode}/state`,method:'GET',success(r){
if(!r||r.statusCode!==200||!r.data)return;const g=r.data;
const me=g.players.find(p=>p.openId===self.myId);
if(me){self.myRole=me.role;self.peekLeft=me.peekRemaining||0;self.alive=me.status==='alive';}
self.zonePoints=(g.config&&g.config.zoneBoundary&&g.config.zoneBoundary.length>=3)?g.config.zoneBoundary:[];
if(g.status==='playing'&&g.startedAt){
const dur=g.config?g.config.duration||900:900;
self.totalDur=dur;
const el=Math.floor((Date.now()-new Date(g.startedAt).getTime())/1000);
self.timeLeft=Math.max(0,dur-el);const m=Math.floor(self.timeLeft/60),s=self.timeLeft%60;
self.timerText=m+':'+String(s).padStart(2,'0');
}else if(g.status==='ended'){self.timerText='结束';}else{self.timerText='准备中...';}
if(g.players){g.players.forEach(sp=>{if(!sp.status)sp.status='alive';if(!sp.role)sp.role='hider';const ep=self.allPlayers.find(p=>p.openId===sp.openId);if(ep){ep.role=sp.role;ep.status=sp.status;ep.peekRemaining=sp.peekRemaining;ep.nickName=sp.nickName||ep.nickName;}else{self.allPlayers.push(sp);}});}
self.buildMarkers();
}});
},
setupWS(s){this.ws=true;
s.on('positions_sync',d=>{if(d&&d.players){d.players.forEach(sp=>{const ep=this.allPlayers.find(q=>q.openId===sp.openId);if(ep){ep.lat=sp.lat;ep.lng=sp.lng;ep.role=sp.role||ep.role;ep.nickName=sp.nickName||ep.nickName;}else{this.allPlayers.push({openId:sp.openId,nickName:sp.nickName,lat:sp.lat,lng:sp.lng,role:sp.role,status:'alive'});}this._setTarget(sp.openId,sp.lat,sp.lng);});this.buildMarkers();}});
s.on('peek_result',d=>{this.peekActive=true;this.peekExp=d.expiresIn;this.peekLeft=d.remainingPeeks;uni.showToast({title:'发现'+(d.hiders||[]).length+'只鼠鼠',icon:'none',duration:2000});if(d.hiders){d.hiders.forEach(h=>{const ep=this.allPlayers.find(p=>p.openId===h.openId);if(ep){ep.lat=h.lat;ep.lng=h.lng;ep.nickName=h.nickName;}else{this.allPlayers.push({openId:h.openId,nickName:h.nickName,lat:h.lat,lng:h.lng,role:'hider',status:'alive'});}this._setTarget(h.openId,h.lat,h.lng);});this.buildMarkers();}});
s.on('peek_expired',()=>{this.peekActive=false;this.peekExp=0;this.buildMarkers();});
s.on('capture_opportunity',d=>{
  this.capTarget=d.target;this.capExp=d.expiresIn;this.flashAlert=true;
  uni.vibrateShort({type:'heavy'});setTimeout(()=>uni.vibrateShort({type:'medium'}),300);setTimeout(()=>uni.vibrateShort({type:'medium'}),600);
  setTimeout(()=>this.flashAlert=false,1500);
});
s.on('player_eliminated',d=>{
  if(d.openId===this.myId){uni.vibrateLong({});}else{uni.vibrateShort({type:'medium'});}
  const t=d.reason==='out_of_bounds'?'越界淘汰':d.reason==='captured'?'被抓！':d.reason==='quit'?'退出游戏':'淘汰';
  this.addLog((d.openId===this.myId?'你':'玩家')+t);
  if(d.openId===this.myId)this.alive=false;
  const ep=this.allPlayers.find(p=>p.openId===d.openId);if(ep)ep.status='eliminated';this.buildMarkers();
});
s.on('player_quit',d=>{if(d&&d.nickName){this.addLog(d.nickName+' 退出了游戏');uni.showToast({title:d.nickName+' 退出游戏',icon:'none',duration:2000});}});
s.on('game_ended',d=>{this.timerText='结束';setTimeout(()=>uni.redirectTo({url:`/pages/result/result?roomCode=${this.roomCode}&winner=${d.winner}&myRole=${this.myRole}&myStatus=${this.alive?'alive':'eliminated'}`}),2000);});
},
addLog(m){this.log.unshift({t:new Date().toLocaleTimeString(),m});this.log=this.log.slice(0,4);this.logVisible=true;if(this.logTimer)clearTimeout(this.logTimer);this.logTimer=setTimeout(()=>{this.logVisible=false;},3000);},
onRegionChange(e){if(e&&e.detail&&e.detail.causedBy&&e.detail.causedBy!=='update'){this.offCenter=true;}},
recenter(){this.center={lat:this.mc.lat,lng:this.mc.lng};this.offCenter=false;if(this.mapCtx)this.mapCtx.moveToLocation({fail:()=>{}});},
zoomIn(){this._zoom(2);},
zoomOut(){this._zoom(-2);},
_zoom(delta){if(!this.mapCtx)return;this.mapCtx.getScale({success:r=>{const s=Math.min(20,Math.max(3,(r.scale||this.scale)+delta));this.scale=s;this.mapCtx.setScale({scale:s});}});},
	_distHav(a,b){const R=6371000;const dLat=(b.lat-a.lat)*Math.PI/180;const dLng=(b.lng-a.lng)*Math.PI/180;const s=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));},
	_rgba(r,g,b,a){const h=x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0');return '#'+h(r)+h(g)+h(b)+h(a);},
startTrack(){const s=getGameSocket();const base=getGpsInterval();const ivl=this.myRole==='hider'?Math.max(base,5000):base;this._centered=false;this._lt=setInterval(()=>{uni.getLocation({type:'gcj02',success:r=>{this.mc={lat:r.latitude,lng:r.longitude};if(!this._centered){this.center={lat:r.latitude,lng:r.longitude};this._centered=true;}s.sendPosition(r.latitude,r.longitude);},fail:()=>{}});},ivl);},
onPeek(){if(this.myRole!=='seeker'){uni.showToast({title:'仅寻找者可查看',icon:'none'});return;}if(this.peekLeft<=0){uni.showToast({title:'无剩余次数',icon:'none'});return;}getGameSocket().usePeek();},
onExit(){const self=this;uni.showModal({title:'退出游戏',content:'确定退出回到首页？',success:r=>{if(r.confirm){getGameSocket().send('player_quit',{nickName:getApp().getNickName()||'玩家'});setTimeout(()=>{if(self.timer)clearInterval(self.timer);if(self._lt)clearInterval(self._lt);getGameSocket().disconnect();uni.reLaunch({url:'/pages/index/index'});},300);}}});},
onCap(){getGameSocket().confirmCapture(this.capTarget.openId);this.capTarget=null;uni.vibrateShort({type:'heavy'});uni.showToast({title:'已抓捕',icon:'success'});},
onCapNo(){this.capTarget=null;},
}
};
</script>

<style scoped>
.page{width:100vw;height:100vh;position:relative;overflow:hidden;background:#FCF6E3;}
.flash-alert{animation:flashBg 0.5s ease-in-out 3;}
@keyframes flashBg{0%,100%{background:#FCF6E3}50%{background:#FFE0D0}}

/* ── 全屏地图 ── */
.map-area{position:absolute;top:0;left:0;right:0;bottom:0;}
.g-map{width:100%;height:100%;}

/* ── 顶部：状态条 + 退出（cover-view 安全样式：无 backdrop-filter / gap / 渐变）── */
.top-row{position:absolute;top:0;left:16rpx;right:16rpx;display:flex;flex-direction:row;align-items:stretch;z-index:20;}
.top-bar{flex:1;display:flex;flex-direction:row;align-items:center;padding:16rpx 24rpx;background:rgba(255,255,255,0.95);border-radius:24rpx;}
.role-tag{display:flex;flex-direction:row;align-items:center;padding:6rpx 18rpx 6rpx 8rpx;border-radius:30rpx;flex-shrink:0;}
.role-tag.seeker{background:#FFA07A;color:#fff;}
.role-tag.hider{background:#6FCB94;color:#fff;}
.role-avatar{width:40rpx;height:40rpx;border-radius:50%;margin-right:8rpx;}
.role-text{font-size:24rpx;font-weight:800;}
.timer-wrap{flex:1;display:flex;flex-direction:column;align-items:center;margin:0 20rpx;}
.timer{font-size:40rpx;font-weight:900;color:#4A3728;line-height:1;}
.timer.danger{color:#E74C3C;}
.timer-bar{width:100%;height:8rpx;background:#F5F0E5;border-radius:4rpx;overflow:hidden;margin-top:4rpx;}
.timer-bar-fill{height:100%;background:#FF6B35;border-radius:4rpx;}
.alive-wrap{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;}
.alive-item{display:flex;flex-direction:row;align-items:center;}
.alive-avatar{width:30rpx;height:30rpx;border-radius:50%;margin-right:6rpx;}
.alive-num{font-size:22rpx;font-weight:800;color:#4A3728;}

/* ── 退出按钮 ── */
.exit-btn{width:76rpx;border-radius:24rpx;margin-left:16rpx;background:rgba(255,255,255,0.95);color:#8B7E74;font-size:30rpx;font-weight:700;display:flex;align-items:center;justify-content:center;border:2rpx solid #F0EBE0;}

/* ── 地图控件 ── */
.map-controls{position:absolute;right:16rpx;top:260rpx;display:flex;flex-direction:column;z-index:20;}
.ctrl-btn{width:72rpx;height:72rpx;border-radius:50%;background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;font-size:30rpx;color:#4A3728;border:2rpx solid #F0EBE0;margin-bottom:16rpx;}
.ctrl-btn:last-child{margin-bottom:0;}
.ctrl-btn.ctrl-alert{color:#FF6B35;border-color:#FF6B35;}

/* ── 居中悬浮行（cover-view 不用 transform，用 flex 居中）── */
.chip-row{position:absolute;left:0;right:0;display:flex;flex-direction:row;justify-content:center;z-index:20;}

/* ── 边界预警 ── */
.boundary-chip-row{bottom:200rpx;}
.boundary-chip{background:rgba(255,255,255,0.95);color:#8B7E74;padding:10rpx 24rpx;border-radius:20rpx;font-size:24rpx;font-weight:600;}
.boundary-chip.boundary-urgent{color:#fff;background:rgba(231,76,60,0.95);}

/* ── peek 距离读数 ── */
.nearest-chip-row{top:220rpx;}
.nearest-chip{background:rgba(46,204,113,0.95);color:#fff;padding:10rpx 24rpx;border-radius:20rpx;font-size:24rpx;font-weight:700;}

/* ── Peek 按钮 ── */
.peek-btn-row{bottom:calc(env(safe-area-inset-bottom) + 32rpx);}
.peek-btn{background:#FF6B35;color:#fff;padding:20rpx 44rpx;border-radius:40rpx;font-size:28rpx;font-weight:700;}
.peek-btn.peek-active{background:#2ECC71;}
.peek-btn.peek-empty{background:#C4B8A8;}

/* ── 日志 ── */
.log-scroll{position:absolute;left:16rpx;bottom:calc(env(safe-area-inset-bottom) + 150rpx);max-width:60%;background:rgba(0,0,0,0.55);border-radius:16rpx;padding:12rpx 20rpx;z-index:20;}
.log-item{font-size:22rpx;color:rgba(255,255,255,0.9);padding:2rpx 0;}

/* ── 抓捕弹窗 ── */
.cap-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999;display:flex;align-items:center;justify-content:center;}
.cap-card{background:#FFF;border-radius:28rpx;padding:40rpx 32rpx;width:560rpx;text-align:center;}
.cap-alert{font-size:36rpx;font-weight:900;color:#E74C3C;margin-bottom:8rpx;}
.cap-player{font-size:42rpx;font-weight:800;color:#4A3728;margin-bottom:8rpx;}
.cap-dist{font-size:28rpx;color:#8B7E74;margin-bottom:20rpx;}
.cap-bar-bg{width:100%;height:12rpx;background:#F5F0E5;border-radius:6rpx;overflow:hidden;margin-bottom:10rpx;}
.cap-bar-fill{height:100%;background:#FF6B35;border-radius:6rpx;}
.cap-bar-fill.urgent{background:#E74C3C;}
.cap-countdown{font-size:22rpx;color:#C4B8A8;margin-bottom:24rpx;}
.cap-row{display:flex;flex-direction:row;}
.btn-catch{flex:2;background:#E74C3C;color:#fff;border-radius:40rpx;padding:18rpx;font-size:28rpx;font-weight:800;text-align:center;}
.btn-pass{flex:1;background:#F5F0E5;color:#8B7E74;border-radius:40rpx;padding:18rpx;font-size:26rpx;text-align:center;margin-left:16rpx;}
</style>
