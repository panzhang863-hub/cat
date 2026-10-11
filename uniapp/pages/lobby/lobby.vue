<template>
  <view class="container">
    <view class="glow glow-a"></view>
    <view class="glow glow-b"></view>

    <!-- 背景音乐开关 -->
    <view class="bgm-btn" :class="bgmOn?'':'bgm-off'" @tap="onToggleBgm">
      <text>{{ bgmOn ? '🎵' : '🔇' }}</text>
    </view>

    <!-- 房间入场券 -->
    <view class="ticket">
      <view class="notch notch-l"></view>
      <view class="notch notch-r"></view>

      <view class="t-top">
        <text class="t-label">🎫 房间号</text>
        <text v-if="isHost" class="t-host-badge">我是房主</text>
      </view>

      <text class="t-code" @click="onShare">{{ roomCode }}</text>
      <text class="t-copy-hint">点一下房间号复制给朋友</text>

      <view class="t-actions">
        <view class="t-btn t-btn-copy" @click="onShare">📋 复制</view>
        <view v-if="isHost" class="t-btn t-btn-set" @click="onConfigure">🐾 设置</view>
        <view class="t-btn" :class="zoneOk?'t-btn-zone':'t-btn-zone-off'" @click="onViewZone">🗺️ {{ zoneOk?'看区域':'未设区域' }}</view>
      </view>
    </view>

    <!-- 猫猫区 -->
    <view class="zone zone-cat">
      <view class="z-head">
        <view class="z-title-wrap">
          <image class="z-icon" src="/static/avatar-cat.png" mode="aspectFit"></image>
          <text class="z-title">猫猫</text>
          <text class="z-sub">追捕者</text>
        </view>
        <text class="z-count">{{ countCat }}/5</text>
      </view>
      <view class="seats">
        <block v-for="(s,idx) in catSlots" :key="idx">
          <view v-if="s" :class="['seat',s.isMe?'seat-me':'']" @tap="onPlayerTap(s)">
            <image class="seat-avatar" src="/static/avatar-cat.png" mode="aspectFit"></image>
            <text class="seat-name">{{ s.nickName }}</text>
            <text v-if="s.isMe" class="seat-badge me">我</text>
            <text v-if="s.isHost" class="seat-badge host">房主</text>
          </view>
          <view v-else class="seat seat-empty" @click="moveToSlot(idx)">
            <text class="seat-plus">＋</text>
          </view>
        </block>
      </view>
    </view>

    <!-- 鼠鼠区 -->
    <view class="zone zone-mouse">
      <view class="z-head">
        <view class="z-title-wrap">
          <image class="z-icon" src="/static/avatar-mouse.png" mode="aspectFit"></image>
          <text class="z-title">鼠鼠</text>
          <text class="z-sub">躲藏者</text>
        </view>
        <text class="z-count">{{ countMouse }}/25</text>
      </view>
      <view class="seats">
        <block v-for="(s,idx) in mouseSlots" :key="idx">
          <view v-if="s" :class="['seat',s.isMe?'seat-me':'']" @tap="onPlayerTap(s)">
            <image class="seat-avatar" src="/static/avatar-mouse.png" mode="aspectFit"></image>
            <text class="seat-name">{{ s.nickName }}</text>
            <text v-if="s.isMe" class="seat-badge me">我</text>
            <text v-if="s.isHost" class="seat-badge host">房主</text>
          </view>
          <view v-else class="seat seat-empty" @click="moveToSlot(idx+5)">
            <text class="seat-plus">＋</text>
          </view>
        </block>
      </view>
    </view>

    <!-- 房间信息 -->
    <view class="info">
      <view class="info-pill">⏱️ {{ config.duration/60 }} 分钟</view>
      <view class="info-pill">👀 {{ config.peekCount }} 次查看</view>
    </view>

    <!-- 操作 -->
    <view class="actions">
      <button v-if="isHost&&players.length>=2" class="btn-start" @click="onStartGame">🎮 开始游戏</button>
      <text v-if="players.length<2&&isRejoin" class="hint">其他玩家可通过相同房间码重新加入</text>
      <text v-else-if="players.length<2" class="hint">{{ isHost?'快把房间码发给朋友们吧！':'等待其他玩家加入...' }}</text>
      <text class="leave" @click="onLeave">离开房间</text>
    </view>
  </view>
</template>

<script>
import { playSfx, playBgm, stopBgm, toggleBgm, isBgmOn } from '../../utils/audio.js';
const CAT_MAX=5, MOUSE_MAX=25, TOTAL=30;

export default {
  data(){return{
    roomCode:'',isHost:false,myId:'',myNick:'',isRejoin:false,
    players:[],slots:Array(TOTAL).fill(null),pollN:0,_lastCount:0,
    config:{duration:900,peekCount:3,zoneBoundary:[]},
    pollingTimer:null,refreshing:false,bgmOn:true
  };},
  computed:{
    countCat(){return this.slots.slice(0,CAT_MAX).filter(Boolean).length;},
    countMouse(){return this.slots.slice(CAT_MAX).filter(Boolean).length;},
    catSlots(){return this.slots.slice(0,5);},
    mouseSlots(){return this.slots.slice(5,30);},
    zoneOk(){return this.config&&this.config.zoneBoundary&&this.config.zoneBoundary.length>=3;}
  },
  onLoad(o){
    this.roomCode=o.roomCode||'';this.isHost=(o.isHost==='1');this.isRejoin=(o.rejoin==='1');
    this.myId=getApp().getOpenId();
    this.myNick=decodeURIComponent(o.nick||'');
    if(this.myNick)getApp().globalData.nickName=this.myNick;
    if(o.players){try{this._buildSlots(JSON.parse(decodeURIComponent(o.players)));}catch(e){}}
    this._stopped=false;
    this.bgmOn=isBgmOn();
    playBgm();
    this.startPolling();
  },
  onUnload(){this._stopped=true;if(this.pollingTimer)clearTimeout(this.pollingTimer);stopBgm();},
  onShareAppMessage(){return{title:`来抓猫猫！加入我的房间 ${this.roomCode}`,path:`/pages/index/index?room=${this.roomCode}`};},
  onShareTimeline(){return{title:'抓猫猫 · 现实世界捉迷藏'};},
  methods:{
    startPolling(){
      const self=this;
      const doPoll=function(){
        uni.request({url:`${getApp().globalData.serverUrl}/api/room/${self.roomCode}`,method:'GET',
          success(r){
            self.pollN++;
            if(!r||r.statusCode!==200){
              if(r&&r.statusCode===404){
                uni.request({url:`${getApp().globalData.serverUrl}/api/room/${self.roomCode}/rejoin`,method:'POST',data:{openId:self.myId},success(rr){if(rr.statusCode===200){self.players=rr.data.players;self.config=rr.data.config||self.config;self._buildSlots(rr.data.players);}},fail(){uni.showToast({title:'重连失败',icon:'none'});},complete(){if(!self._stopped)self.pollingTimer=setTimeout(poll,1500);}});
              }
              return;
            }
            const list=r.data.players||[];
            if(self._lastCount>0&&self.pollN>1){
              if(list.length>self._lastCount){uni.showToast({title:'有新玩家加入！',icon:'none',duration:1500});playSfx('join');}
              else if(list.length<self._lastCount){uni.showToast({title:'有玩家离开了',icon:'none',duration:1500});playSfx('tap');}
            }
            self._lastCount=list.length;
            self.players=list;
            self.config=r.data.config||self.config;
            self._buildSlots(list);
            if(r.data.status==='preparing'||r.data.status==='playing'){
              uni.redirectTo({url:`/pages/game/game?roomCode=${self.roomCode}`});
              return;
            }
            if(!self._stopped)self.pollingTimer=setTimeout(poll,1500);
          },
          fail(){self.pollN++;if(!self._stopped)self.pollingTimer=setTimeout(poll,1500);}
        });
      };
      function poll(){
        if(self._stopped)return;
        uni.request({url:`${getApp().globalData.serverUrl}/api/room/${self.roomCode}/kicked?openId=${self.myId}`,method:'GET',
          success(rr){
            if(rr.statusCode===200&&rr.data&&rr.data.kicked){
              if(self.pollingTimer)clearTimeout(self.pollingTimer);
              uni.showToast({title:'您已被踢出房间',icon:'none',duration:2500});
              setTimeout(()=>uni.reLaunch({url:'/pages/index/index'}),1500);
              return;
            }
            doPoll();
          },
          fail(){doPoll();}
        });
      }
      poll();
    },
    _buildSlots(list){
      const hostId=list.length>0?list[0].openId:null;
      if(this.myId===hostId)this.isHost=true;else this.isHost=false;
      for(let i=0;i<TOTAL;i++)this.$set(this.slots,i,null);
      list.forEach(p=>{
        let sidx=p.slot;
        const start=p.side==='cat'?0:CAT_MAX;
        const end=p.side==='cat'?CAT_MAX:TOTAL;
        if(sidx==null||sidx<start||sidx>=end||this.slots[sidx]){
          for(let i=start;i<end;i++){if(!this.slots[i]){sidx=i;break;}}
          if(sidx==null)sidx=start;
        }
        this.$set(this.slots,sidx,{openId:p.openId,nickName:p.nickName,isMe:p.openId===this.myId,isHost:p.openId===hostId});
      });
    },
    moveToSlot(sidx){
      if(this.slots[sidx]){uni.showToast({title:'坑位已被占',icon:'none'});playSfx('tap');return;}
      const isCat=sidx<CAT_MAX;
      if(isCat&&this.countCat>=CAT_MAX){uni.showToast({title:'猫猫已满',icon:'none'});playSfx('tap');return;}
      if(!isCat&&this.countMouse>=MOUSE_MAX){uni.showToast({title:'鼠鼠已满',icon:'none'});playSfx('tap');return;}
      for(let i=0;i<TOTAL;i++){if(this.slots[i]&&this.slots[i].openId===this.myId)this.$set(this.slots,i,null);}
      const me=this.players.find(p=>p.openId===this.myId);
      const hostId=this.players.length>0?this.players[0].openId:null;
      this.$set(this.slots,sidx,{openId:this.myId,nickName:me?me.nickName:this.myNick,isMe:true,isHost:this.myId===hostId});
      playSfx('pop');
      uni.request({url:`${getApp().globalData.serverUrl}/api/room/${this.roomCode}/side`,method:'POST',data:{openId:this.myId,side:isCat?'cat':'mouse',slot:sidx}});
    },
    onConfigure(){
      let url=`/pages/config/config?roomCode=${this.roomCode}&duration=${this.config.duration}&peekCount=${this.config.peekCount}`;
      if(this.config.zoneBoundary&&this.config.zoneBoundary.length>=3){
        url+=`&zone=${encodeURIComponent(JSON.stringify(this.config.zoneBoundary))}`;
      }
      uni.navigateTo({url,events:{onConfigSaved:(d)=>{this.config={...this.config,...d};}}});
    },
    onViewZone(){
      if(!this.config.zoneBoundary||this.config.zoneBoundary.length<3){uni.showToast({title:'房主还未设置区域',icon:'none'});return;}
      const zb=encodeURIComponent(JSON.stringify(this.config.zoneBoundary));
      uni.navigateTo({url:`/pages/config/config?roomCode=${this.roomCode}&viewOnly=1&zone=${zb}`});
    },
    onStartGame(){
      if(!this.config.zoneBoundary||this.config.zoneBoundary.length<3){uni.showModal({title:'未设置游戏区域',content:'请先在「房间设置」中在地图上画出区域',showCancel:false});return;}
      if(this.countCat===0||this.countMouse===0){uni.showToast({title:'至少需要1只猫猫和1只鼠鼠',icon:'none'});return;}
      const self=this;
      uni.showModal({title:'开始游戏',content:`${this.config.duration/60}分钟 · ${this.config.peekCount}次查看 · ${this.players.length}人`,success(re){
        if(!re.confirm)return;
        playSfx('start');
        uni.request({url:`${getApp().globalData.serverUrl}/api/game/${self.roomCode}/start`,method:'POST',data:{openId:getApp().getOpenId(),zoneBoundary:self.config.zoneBoundary,duration:self.config.duration,peekCount:self.config.peekCount},success(r){
          if(r.statusCode===200&&r.data.success){uni.showToast({title:'开始！',icon:'success'});if(self.pollingTimer)clearInterval(self.pollingTimer);setTimeout(()=>uni.redirectTo({url:`/pages/game/game?roomCode=${self.roomCode}`}),800);}else uni.showToast({title:r.data.error||'失败',icon:'none'});
        },fail:()=>uni.showToast({title:'网络错误',icon:'none'})});
      }});
    },
    onPlayerTap(p){
      if(!this.isHost||p.isMe)return;
      const self=this;
      uni.showActionSheet({
        itemList:['踢出房间','转让房主'],
        success(r){
          if(r.tapIndex===0){self.doKick(p);}
          else if(r.tapIndex===1){self.doTransfer(p);}
        }
      });
    },
    doKick(p){
      const self=this;
      uni.showModal({title:'踢出玩家',content:`确定把 ${p.nickName} 踢出房间？`,success(re){
        if(!re.confirm)return;
        uni.request({url:`${getApp().globalData.serverUrl}/api/room/${self.roomCode}/kick`,method:'POST',data:{openId:self.myId,targetOpenId:p.openId},success(r){
          if(r.statusCode===200){uni.showToast({title:'已踢出',icon:'success'});self.refreshNow();}
          else{uni.showToast({title:(r.data&&r.data.error)||'失败',icon:'none'});}
        },fail:()=>uni.showToast({title:'网络错误',icon:'none'})});
      }});
    },
    doTransfer(p){
      const self=this;
      uni.showModal({title:'转让房主',content:`确定把房主转让给 ${p.nickName}？`,success(re){
        if(!re.confirm)return;
        uni.request({url:`${getApp().globalData.serverUrl}/api/room/${self.roomCode}/transfer`,method:'POST',data:{openId:self.myId,targetOpenId:p.openId},success(r){
          if(r.statusCode===200){uni.showToast({title:'已转让',icon:'success'});self.refreshNow();}
          else{uni.showToast({title:(r.data&&r.data.error)||'失败',icon:'none'});}
        },fail:()=>uni.showToast({title:'网络错误',icon:'none'})});
      }});
    },
    onLeave(){const self=this;uni.showModal({title:'离开',content:'确定？',success(re){if(!re.confirm)return;uni.request({url:`${getApp().globalData.serverUrl}/api/room/${self.roomCode}/leave`,method:'POST',data:{openId:getApp().getOpenId()},success:()=>{if(self.pollingTimer)clearTimeout(self.pollingTimer);uni.navigateBack();},fail:()=>{if(self.pollingTimer)clearTimeout(self.pollingTimer);uni.navigateBack();}});}});},
    refreshNow(){if(this.pollingTimer)clearTimeout(this.pollingTimer);this.startPolling();},
    onShare(){uni.setClipboardData({data:this.roomCode,success:()=>{uni.showToast({title:'已复制',icon:'success'});playSfx('tap');}});},
    onToggleBgm(){this.bgmOn=toggleBgm();},
  }
};
</script>

<style scoped>
.container{position:relative;padding:32rpx 32rpx 60rpx;min-height:100vh;overflow:hidden;}
.glow{position:absolute;border-radius:50%;pointer-events:none;z-index:0;}
.glow-a{top:-120rpx;right:-120rpx;width:420rpx;height:420rpx;background:radial-gradient(circle,rgba(255,200,160,0.28),transparent 70%);}
.glow-b{bottom:120rpx;left:-140rpx;width:460rpx;height:460rpx;background:radial-gradient(circle,rgba(180,220,190,0.22),transparent 70%);}
.bgm-btn{position:fixed;top:24rpx;right:24rpx;width:72rpx;height:72rpx;border-radius:50%;background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center;font-size:32rpx;box-shadow:0 4rpx 16rpx rgba(0,0,0,0.10);z-index:50;}
.bgm-btn.bgm-off{opacity:0.55;}

/* ── 房间入场券 ── */
.ticket{position:relative;z-index:1;background:#FFF;border-radius:32rpx;padding:30rpx 28rpx 26rpx;text-align:center;margin-bottom:26rpx;box-shadow:0 10rpx 30rpx rgba(255,170,90,0.14);}
/* 撕票缺口（穿孔效果） */
.notch{position:absolute;top:50%;width:30rpx;height:30rpx;border-radius:50%;background:#FCF6E3;transform:translateY(-50%);z-index:2;}
.notch-l{left:-15rpx;}
.notch-r{right:-15rpx;}
/* 顶部 */
.t-top{display:flex;justify-content:center;align-items:center;gap:16rpx;margin-bottom:10rpx;}
.t-label{font-size:24rpx;color:#C4B8A8;letter-spacing:4rpx;font-weight:600;}
.t-host-badge{font-size:20rpx;color:#FF7A50;background:rgba(255,160,122,0.14);padding:4rpx 16rpx;border-radius:20rpx;font-weight:700;}
/* 房间号 */
.t-code{font-size:92rpx;font-weight:900;color:#FF7A50;letter-spacing:14rpx;display:block;line-height:1.1;}
.t-copy-hint{font-size:20rpx;color:#D8D0C8;display:block;margin:4rpx 0 20rpx;}
/* 操作按钮 */
.t-actions{display:flex;justify-content:center;gap:16rpx;flex-wrap:wrap;}
.t-btn{display:inline-flex;align-items:center;justify-content:center;padding:14rpx 30rpx;border-radius:36rpx;font-size:26rpx;font-weight:700;box-shadow:0 4rpx 14rpx rgba(0,0,0,0.05);}
.t-btn:active{opacity:0.8;transform:scale(0.96);}
.t-btn-copy{background:linear-gradient(135deg,#FF9A7A,#FF7A50);color:#fff;}
.t-btn-set{background:linear-gradient(135deg,#FFDD75,#FFC850);color:#7A5B1E;}
.t-btn-zone{background:rgba(123,200,164,0.20);color:#4E9A6E;}
.t-btn-zone-off{background:#F5F0E5;color:#B8A898;}

/* ── 阵营分区 ── */
.zone{position:relative;z-index:1;background:#FFF;border-radius:30rpx;padding:26rpx 22rpx 22rpx;margin-bottom:22rpx;box-shadow:0 8rpx 30rpx rgba(0,0,0,0.04);overflow:hidden;}
.zone-cat{border-top:10rpx solid #FFA07A;}
.zone-mouse{border-top:10rpx solid #7BC8A4;}
.z-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22rpx;}
.z-title-wrap{display:flex;align-items:center;}
.z-icon{width:44rpx;height:44rpx;border-radius:50%;margin-right:12rpx;}
.z-title{font-size:32rpx;font-weight:800;color:#4A3728;margin-right:10rpx;}
.z-sub{font-size:20rpx;color:#C4B8A8;background:#FAF7F0;padding:2rpx 14rpx;border-radius:14rpx;}
.z-count{font-size:26rpx;font-weight:800;color:#8B7E74;background:#FAF7F0;padding:6rpx 22rpx;border-radius:24rpx;}

/* ── 坑位格 ── */
.seats{display:flex;flex-wrap:wrap;gap:16rpx;}
.seat{width:108rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:96rpx;padding:12rpx 4rpx 8rpx;border-radius:20rpx;position:relative;}
.seat-avatar{width:60rpx;height:60rpx;border-radius:50%;display:block;}
.seat-name{font-size:18rpx;color:#4A3728;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:104rpx;margin-top:4rpx;}
.seat-me{background:rgba(255,221,117,0.28);border:2rpx solid #FFDD75;}
.seat-badge{position:absolute;top:-4rpx;font-size:16rpx;padding:1rpx 8rpx;border-radius:10rpx;line-height:1.4;}
.seat-badge.me{right:-4rpx;background:#FFDD75;color:#4A3728;font-weight:700;}
.seat-badge.host{left:-4rpx;background:#FFA07A;color:#fff;font-weight:700;}
.seat-empty{justify-content:center;background:transparent;border:none;}
.seat-empty .seat-plus{width:56rpx;height:56rpx;border:2rpx dashed #E8E0D0;border-radius:50%;background:#FAF7F0;display:flex;align-items:center;justify-content:center;font-size:30rpx;color:#C4B8A8;}

/* ── 房间信息 ── */
.info{position:relative;z-index:1;display:flex;gap:20rpx;justify-content:center;margin-bottom:22rpx;}
.info-pill{font-size:24rpx;color:#8B7E74;background:#FFF;padding:10rpx 26rpx;border-radius:30rpx;box-shadow:0 4rpx 16rpx rgba(0,0,0,0.04);}

/* ── 操作 ── */
.actions{position:relative;z-index:1;display:flex;flex-direction:column;gap:10rpx;align-items:center;}
.btn-start{background:linear-gradient(135deg,#FF9A7A,#FF7A50);color:#fff;border:none;border-radius:44rpx;padding:20rpx 80rpx;font-size:32rpx;font-weight:800;box-shadow:0 8rpx 24rpx rgba(255,122,80,0.30);}
.btn-start:active{opacity:0.85;transform:scale(0.97);}
.hint{font-size:24rpx;color:#C4B8A8;padding:8rpx;}
.leave{font-size:26rpx;color:#C4B8A8;padding:16rpx;}
</style>
