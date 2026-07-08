<template>
  <view class="container">
    <view class="code-section">
      <text class="code-label">房间码</text>
      <text class="room-code">{{ roomCode }}</text>
      <view class="code-actions">
        <text class="action-link" @click="onShare">📋 复制分享</text>
        <text v-if="isHost" class="action-link" @click="onConfigure">🐾 房间设置</text>
        <text class="action-link" @click="onViewZone">
          🗺️ {{ config.zoneBoundary.length>=3?'查看区域':'区域未设' }}
        </text>
      </view>
    </view>

    <!-- 猫猫区 -->
    <view class="card cat-zone">
      <view style="display:flex;justify-content:space-between;">
        <text class="card-title">🐱 猫猫 ({{ countCat }}/5)</text>
        <text style="font-size:20rpx;color:#C4B8A8;" @click="refreshNow">🔄刷新</text>
      </view>
      <view class="player-grid">
        <view v-for="i in 5" :key="'c'+i" class="player-cell-wrap">
          <view v-if="slots[i-1]" :class="['player-cell',slots[i-1].isMe?'my-cell':'']">
            <text class="p-icon">🐱</text>
            <text class="p-name">{{ slots[i-1].nickName }}</text>
            <text v-if="slots[i-1].isHost" class="host-tag">房</text>
          </view>
          <view v-else class="player-cell empty" @click="moveToSlot(i-1)">
            <text class="p-icon dim-icon">🐱</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 鼠鼠区 -->
    <view class="card mouse-zone">
      <text class="card-title">🐭 鼠鼠 ({{ countMouse }}/25)</text>
      <view class="player-grid">
        <view v-for="i in 25" :key="'m'+i" class="player-cell-wrap">
          <view v-if="slots[5+i-1]" :class="['player-cell',slots[5+i-1].isMe?'my-cell':'']">
            <text class="p-icon">🐭</text>
            <text class="p-name">{{ slots[5+i-1].nickName }}</text>
            <text v-if="slots[5+i-1].isHost" class="host-tag">房</text>
          </view>
          <view v-else class="player-cell empty" @click="moveToSlot(5+i-1)">
            <text class="p-icon dim-icon">🐭</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 配置 -->
    <view class="card config-card">
      <view class="c-row"><text>🐾 游戏时长</text><text class="c-val">{{ config.duration/60 }} 分钟</text></view>
      <view class="c-row"><text>👀 查看次数</text><text class="c-val">{{ config.peekCount }} 次</text></view>
    </view>

    <view class="actions">
      <button v-if="isHost&&players.length>=2" class="btn-main" @click="onStartGame">🎮 开始游戏</button>
      <text v-if="players.length<2" class="hint">至少需要 2 人才能开始</text>
      <text class="leave-btn" @click="onLeave">离开房间</text>
    </view>
  </view>
</template>

<script>
const CAT_MAX=5, MOUSE_MAX=25, TOTAL=30;

export default {
  data(){return{
    roomCode:'',isHost:false,myId:'',myNick:'',
    players:[],slots:Array(TOTAL).fill(null),pollN:0,
    config:{duration:900,peekCount:3,zoneBoundary:[]},
    pollingTimer:null,refreshing:false
  };},
  computed:{
    countCat(){return this.slots.slice(0,CAT_MAX).filter(Boolean).length;},
    countMouse(){return this.slots.slice(CAT_MAX).filter(Boolean).length;}
  },
  onLoad(o){
    this.roomCode=o.roomCode||'';this.isHost=(o.isHost==='1');
    this.myId=getApp().getOpenId();
    this.myNick=decodeURIComponent(o.nick||'');
    if(this.myNick)getApp().globalData.nickName=this.myNick;
    // 如果有初始玩家列表，立即显示
    if(o.players){try{this._buildSlots(JSON.parse(decodeURIComponent(o.players)));}catch(e){}}
    this._stopped=false;
    this.startPolling();
  },
  onUnload(){this._stopped=true;if(this.pollingTimer)clearTimeout(this.pollingTimer);},
  methods:{
    startPolling(){
      const self=this;
      function poll(){
        if(self._stopped)return;
        uni.request({url:`${getApp().globalData.serverUrl}/api/room/${self.roomCode}`,method:'GET',
          success(r){
            self.pollN++;
            if(!r||r.statusCode!==200){
              if(r&&r.statusCode===404){
                // 尝试重新加入（再来一局）
                uni.request({url:`${getApp().globalData.serverUrl}/api/room/${self.roomCode}/rejoin`,method:'POST',data:{openId:self.myId},success(rr){if(rr.statusCode===200){self.players=rr.data.players;self.config=rr.data.config||self.config;self._buildSlots(rr.data.players);}},fail(){uni.showToast({title:'重连失败',icon:'none'});}});
              }
              return;
            }
            const list=r.data.players||[];
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
      }
      poll();
    },
    _buildSlots(list){
      const hostId=list.length>0?list[0].openId:null;
      // 重新判断自己是不是房主
      if(this.myId===hostId)this.isHost=true;
      for(let i=0;i<TOTAL;i++)this.$set(this.slots,i,null);
      list.forEach(p=>{
        let sidx=p.slot;
        const start=p.side==='cat'?0:CAT_MAX;
        const end=p.side==='cat'?CAT_MAX:TOTAL;
        // slot无效或在同阵营区已被占 → 找空位
        if(sidx==null||sidx<start||sidx>=end||this.slots[sidx]){
          for(let i=start;i<end;i++){if(!this.slots[i]){sidx=i;break;}}
          if(sidx==null)sidx=start;
        }
        this.$set(this.slots,sidx,{openId:p.openId,nickName:p.nickName,isMe:p.openId===this.myId,isHost:p.openId===hostId});
      });
    },
    moveToSlot(sidx){
      if(this.slots[sidx]){uni.showToast({title:'坑位已被占',icon:'none'});return;}
      const isCat=sidx<CAT_MAX;
      if(isCat&&this.countCat>=CAT_MAX){uni.showToast({title:'猫猫已满',icon:'none'});return;}
      if(!isCat&&this.countMouse>=MOUSE_MAX){uni.showToast({title:'鼠鼠已满',icon:'none'});return;}
      // 从旧位置清除
      for(let i=0;i<TOTAL;i++){if(this.slots[i]&&this.slots[i].openId===this.myId)this.$set(this.slots,i,null);}
      // 放入新位置
      const me=this.players.find(p=>p.openId===this.myId);
      const hostId=this.players.length>0?this.players[0].openId:null;
      this.$set(this.slots,sidx,{openId:this.myId,nickName:me?me.nickName:this.myNick,isMe:true,isHost:this.myId===hostId});
      // 通知后端（带上坑位号）
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
        uni.request({url:`${getApp().globalData.serverUrl}/api/game/${self.roomCode}/start`,method:'POST',data:{openId:getApp().getOpenId(),zoneBoundary:self.config.zoneBoundary,duration:self.config.duration,peekCount:self.config.peekCount},success(r){
          if(r.statusCode===200&&r.data.success){uni.showToast({title:'开始！',icon:'success'});if(self.pollingTimer)clearInterval(self.pollingTimer);setTimeout(()=>uni.redirectTo({url:`/pages/game/game?roomCode=${self.roomCode}`}),800);}else uni.showToast({title:r.data.error||'失败',icon:'none'});
        },fail:()=>uni.showToast({title:'网络错误',icon:'none'})});
      }});
    },
    onLeave(){const self=this;uni.showModal({title:'离开',content:'确定？',success(re){if(!re.confirm)return;uni.request({url:`${getApp().globalData.serverUrl}/api/room/${self.roomCode}/leave`,method:'POST',data:{openId:getApp().getOpenId()},success:()=>{if(self.pollingTimer)clearTimeout(self.pollingTimer);uni.navigateBack();},fail:()=>{if(self.pollingTimer)clearTimeout(self.pollingTimer);uni.navigateBack();}});}});},
    refreshNow(){if(this.pollingTimer)clearTimeout(this.pollingTimer);this.startPolling();},
    onShare(){uni.setClipboardData({data:this.roomCode,success:()=>uni.showToast({title:'已复制',icon:'success'})});},
  }
};
</script>

<style scoped>
.container{padding:40rpx;min-height:100vh;}
.code-section{text-align:center;margin-bottom:28rpx;}
.code-label{font-size:24rpx;color:#B8A898;}
.room-code{font-size:76rpx;font-weight:900;color:#FFA07A;letter-spacing:14rpx;display:block;margin:10rpx 0;}
.copy-btn{font-size:26rpx;color:#C4B8A8;padding:8rpx 20rpx;border-radius:8rpx;}
.code-actions{display:flex;justify-content:center;gap:32rpx;margin-top:12rpx;}
.action-link{font-size:24rpx;color:#C4B8A8;padding:6rpx 0;}
.action-link:active{color:#FFA07A;}
.card{background:#FFFFFF;border-radius:24rpx;padding:24rpx;margin-bottom:16rpx;box-shadow:0 4rpx 20rpx rgba(0,0,0,0.03);}
.card-title{font-size:26rpx;font-weight:700;color:#8B7E74;margin-bottom:12rpx;display:block;}
.cat-zone{border-left:4rpx solid #FFDD75;}
.mouse-zone{border-left:4rpx solid #D0C8C0;}
.player-grid{display:flex;flex-wrap:wrap;gap:6rpx;}
.player-cell-wrap{width:110rpx;}
.player-cell{display:flex;flex-direction:column;align-items:center;padding:10rpx 2rpx;border-radius:12rpx;background:rgba(255,160,122,0.04);position:relative;}
.player-cell.empty{opacity:0.25;}
.player-cell.my-cell{background:rgba(255,221,117,0.25);border:1rpx solid #FFDD75;}
.p-icon{font-size:32rpx;display:block;margin-bottom:2rpx;}
.dim-icon{opacity:0.45;}
.p-name{font-size:18rpx;color:#4A3728;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100rpx;}
.host-tag{position:absolute;top:2rpx;right:2rpx;background:rgba(255,160,122,0.18);color:#FFA07A;padding:1rpx 8rpx;border-radius:4rpx;font-size:16rpx;}
.config-card{margin-bottom:20rpx;}
.c-row{display:flex;justify-content:space-between;padding:12rpx 0;font-size:26rpx;}
.c-row:not(:last-child){border-bottom:1rpx solid #F5F0E5;}
.c-val{color:#FFA07A;font-weight:700;}
.c-val.warn{color:#E0C090;}
.actions{display:flex;flex-direction:column;gap:10rpx;align-items:center;}
.btn-main{background:linear-gradient(135deg,#FFDD75,#FFC850);color:#4A3728;border:none;border-radius:40rpx;padding:18rpx 56rpx;font-size:30rpx;font-weight:700;box-shadow:0 4rpx 16rpx rgba(255,200,80,0.25);}
.btn-main:active{opacity:0.8;transform:scale(0.97);}
.hint{font-size:24rpx;color:#C4B8A8;padding:8rpx;}
.leave-btn{font-size:26rpx;color:#C4B8A8;padding:16rpx;}
</style>
