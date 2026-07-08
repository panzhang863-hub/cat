<template>
  <view class="container">
    <view class="title-bar">🗺️ 游戏区域设置</view>

    <!-- 地图 -->
    <view class="map-wrap" v-if="!viewOnly">
      <map class="map" id="configMap" :latitude="mapCenter.lat" :longitude="mapCenter.lng" :scale="mapScale" :show-location="true" @regionchange="onRegionChange"
        :circles="showMapCircle"
        :polygons="savedBoundary&&savedBoundary.length>=3?[{points:savedBoundary,fillColor:'#FFA07A20',strokeColor:'#FFA07A',strokeWidth:3}]:[]"></map>

      <!-- 十字准星 -->
      <view class="crosshair">⊕</view>

      <!-- 提示 -->
      <view class="top-hint" v-if="!circleCenter">👆 拖动地图，把 ⊕ 对准你想设的区域中心</view>
      <view class="top-hint placed" v-if="circleCenter">圆心已设 · 半径 {{ circleRadius }} 米</view>
    </view>

    <!-- 查看模式 -->
    <view class="map-wrap" v-if="viewOnly">
      <map class="map" :latitude="mapCenter.lat" :longitude="mapCenter.lng" :scale="15" :show-location="true"
        :polygons="viewPolygons"
        :circles="viewCircles"></map>
      <view class="top-hint placed" v-if="savedBoundary&&savedBoundary.length>=3">游戏区域已显示</view>
    </view>

    <!-- 操作栏 -->
    <view class="control-bar" v-if="!viewOnly">
      <button class="btn-point" @click="onSetCenter" v-if="!circleCenter">📍 在此设圆心</button>
      <button class="btn-point placed" @click="onSetCenter" v-if="circleCenter">📍 移动圆心</button>
      <button class="btn-clear" @click="onClearAll" v-if="circleCenter">✕ 清除</button>
    </view>

    <!-- 半径调节 -->
    <view class="radius-control" v-if="!viewOnly&&circleCenter">
      <view class="radius-label">
        <text>⭕ 区域半径</text>
        <text class="radius-val">{{ circleRadius }} 米</text>
      </view>
      <slider :min="10" :max="500" :step="10" :value="circleRadius" activeColor="#FFA07A" backgroundColor="#F5F0E5" block-size="20" @change="e=>circleRadius=e.detail.value"/>
      <view class="s-ends"><text>10米</text><text>500米</text></view>
    </view>

    <view class="settings" v-if="!viewOnly">
      <view class="s-item">
        <view class="s-head"><text>⏱️ 游戏时长</text><text class="s-val">{{ Math.floor(duration/60) }} 分钟</text></view>
        <slider :min="300" :max="3600" :step="60" :value="duration" activeColor="#FFA07A" backgroundColor="#F5F0E5" block-size="18" @change="e=>duration=e.detail.value"/>
        <view class="s-ends"><text>5分钟</text><text>60分钟</text></view>
      </view>
      <view class="s-item">
        <view class="s-head"><text>👁️ 查看次数</text><text class="s-val">{{ peekCount }} 次</text></view>
        <slider :min="1" :max="10" :step="1" :value="peekCount" activeColor="#FFA07A" backgroundColor="#F5F0E5" block-size="18" @change="e=>peekCount=e.detail.value"/>
        <view class="s-ends"><text>1次</text><text>10次</text></view>
      </view>
      <view class="s-item">
        <view class="s-head"><text>📍 GPS上报</text><text class="s-val">{{ gpsLabel }}</text></view>
        <slider :min="1" :max="3" :step="1" :value="gpsIdx" activeColor="#FFA07A" backgroundColor="#F5F0E5" block-size="18" @change="e=>{gpsIdx=e.detail.value;gpsInterval=[1000,3000,5000][gpsIdx-1];}"/>
        <view class="s-ends"><text>1秒(精准)</text><text>5秒(省电)</text></view>
      </view>
    </view>

    <button class="btn-main" v-if="!viewOnly" @click="onSave">✅ 保存配置</button>
  </view>
</template>

<script>
export default {
  data(){return{
    roomCode:'',duration:900,peekCount:3,mapScale:15,gpsInterval:3000,gpsIdx:2,
    mapCenter:{lat:30.2741,lng:120.1551},circleCenter:null,circleRadius:50,
    savedBoundary:[],viewOnly:false,currentCenter:{lat:30.2741,lng:120.1551}
  };},
  computed:{
    gpsLabel(){const m=this.gpsInterval/1000;return m+'秒'+(m>=5?'(省电)':'');},
    viewPolygons(){
      return (this.viewOnly&&this.savedBoundary&&this.savedBoundary.length>=3)?[{points:this.savedBoundary,fillColor:'#FFA07A30',strokeColor:'#FFA07A',strokeWidth:4}]:[];
    },
    viewCircles(){
      if(!this.viewOnly||!this.savedBoundary||this.savedBoundary.length<3)return[];
      const c=this.savedBoundary[0];let maxD=0;
      for(let i=1;i<this.savedBoundary.length;i++){const R=6371000,dLat=(this.savedBoundary[i].lat-c.lat)*Math.PI/180,dLng=(this.savedBoundary[i].lng-c.lng)*Math.PI/180;const a=Math.sin(dLat/2)**2+Math.cos(c.lat*Math.PI/180)*Math.cos(this.savedBoundary[i].lat*Math.PI/180)*Math.sin(dLng/2)**2;const d=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));if(d>maxD)maxD=d;}
      return [{latitude:c.lat,longitude:c.lng,radius:maxD,fillColor:'#FFA07A25',strokeColor:'#FFA07A',strokeWidth:3}];
    },
    showMapCircle(){
      if(!this.circleCenter||this.circleRadius<=0)return[];
      return [{latitude:this.circleCenter.lat,longitude:this.circleCenter.lng,radius:this.circleRadius,fillColor:'#FFA07A20',strokeColor:'#FFA07A',strokeWidth:3}];
    }
  },
  onLoad(o){
    this.roomCode=o.roomCode||'';this.viewOnly=o.viewOnly==='1';
    if(o.zone){
      try{
        const zb=JSON.parse(decodeURIComponent(o.zone));
        if(zb&&zb.length>=3){
          this.savedBoundary=zb;
          if(this.viewOnly){
            this.mapCenter={lat:zb[0].lat,lng:zb[0].lng};
          }else{
            // 编辑模式：从已有区域还原圆心+半径
            const c=this._polygonCentroid(zb);
            this.circleCenter=c;
            this.mapCenter={...c};
            this.currentCenter={...c};
            this.circleRadius=Math.round(this._haversine(c,zb[0]));
          }
        }
      }catch(e){}
    }
    if(!this.viewOnly){this.duration=parseInt(o.duration)||900;this.peekCount=parseInt(o.peekCount)||3;
      const {getGpsInterval}=require('../../utils/config.js');const gi=getGpsInterval();this.gpsInterval=gi;this.gpsIdx=[1000,3000,5000].indexOf(gi)+1||2;}
    this.init();
  },
  methods:{
    init(){
      const self=this;
      if(this.savedBoundary&&this.savedBoundary.length>=3)return;
      // #ifdef H5
      if(navigator&&navigator.geolocation){navigator.geolocation.getCurrentPosition(p=>{self.mapCenter={lat:p.coords.latitude,lng:p.coords.longitude};self.currentCenter={...self.mapCenter};},()=>{});}
      // #endif
      // #ifndef H5
      uni.getLocation({type:'gcj02',success:r=>{self.mapCenter={lat:r.latitude,lng:r.longitude};self.currentCenter={...self.mapCenter};}});
      // #endif
    },
    onRegionChange(e){
      if(e&&e.detail&&e.detail.centerLocation){
        this.currentCenter={lat:e.detail.centerLocation.latitude,lng:e.detail.centerLocation.longitude};
      }
    },
    onSetCenter(){
      const self=this;
      const mapCtx=uni.createMapContext('configMap',this);
      mapCtx.getCenterLocation({
        success(res){
          self.circleCenter={lat:res.latitude,lng:res.longitude};
          uni.showToast({title:'圆心已设',icon:'success',duration:1000});
        },
        fail(){
          self.circleCenter={...self.currentCenter};
          uni.showToast({title:'圆心已设',icon:'success',duration:1000});
        }
      });
    },
    onClearAll(){this.circleCenter=null;this.circleRadius=50;},
    _polygonCentroid(pts){
      let lat=0,lng=0;
      pts.forEach(p=>{lat+=p.lat;lng+=p.lng;});
      return {lat:lat/pts.length,lng:lng/pts.length};
    },
    _haversine(a,b){
      const R=6371000;
      const dLat=(b.lat-a.lat)*Math.PI/180;
      const dLng=(b.lng-a.lng)*Math.PI/180;
      const s=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
      return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
    },
    circleToPolygon(center,radius,numPoints=40){
      const pts=[],R=6371000;
      for(let i=0;i<numPoints;i++){
        const a=(i/numPoints)*Math.PI*2;
        const dLat=(radius/R)*(180/Math.PI);
        const dLng=(radius/(R*Math.cos(center.lat*Math.PI/180)))*(180/Math.PI);
        pts.push({lat:center.lat+dLat*Math.cos(a),lng:center.lng+dLng*Math.sin(a)});
      }
      return pts;
    },
    onSave(){
      if(!this.circleCenter){uni.showToast({title:'请先拖动地图设圆心',icon:'none'});return;}
      if(this.circleRadius<10){uni.showToast({title:'半径至少10米',icon:'none'});return;}
      const boundary=this.circleToPolygon(this.circleCenter,this.circleRadius);
      const ec=this.getOpenerEventChannel();
      ec.emit('onConfigSaved',{duration:this.duration,peekCount:this.peekCount,zoneBoundary:boundary});
      uni.request({url:`${getApp().globalData.serverUrl}/api/room/${this.roomCode}/config`,method:'POST',data:{openId:getApp().getOpenId(),zoneBoundary:boundary,duration:this.duration,peekCount:this.peekCount}});
      const {setGpsInterval}=require('../../utils/config.js');setGpsInterval(this.gpsInterval);
      uni.showToast({title:'已保存',icon:'success'});setTimeout(()=>uni.navigateBack(),800);
    },
  },
};
</script>

<style scoped>
.container{display:flex;flex-direction:column;height:100vh;background:#FCF6E3;}
.title-bar{text-align:center;font-size:30rpx;font-weight:700;color:#4A3728;padding:20rpx 0 12rpx;flex-shrink:0;}
.map-wrap{flex:1;position:relative;overflow:hidden;min-height:350rpx;}
.map{width:100%;height:100%;}
.crosshair{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:48rpx;color:#FF6B35;opacity:0.7;z-index:10;pointer-events:none;}
.top-hint{position:absolute;top:12rpx;left:50%;transform:translateX(-50%);z-index:10;background:rgba(255,255,255,0.9);color:#8B7E74;padding:8rpx 24rpx;border-radius:12rpx;font-size:24rpx;white-space:nowrap;box-shadow:0 2rpx 8rpx rgba(0,0,0,0.04);}
.top-hint.placed{color:#FFA07A;background:rgba(255,160,122,0.1);}
.control-bar{display:flex;justify-content:center;gap:20rpx;padding:12rpx;flex-shrink:0;}
.btn-point{background:#FFA07A;color:#fff;border:none;border-radius:40rpx;padding:14rpx 40rpx;font-size:28rpx;font-weight:600;}
.btn-point.placed{background:#8B7E74;}
.btn-clear{background:transparent;color:#C4B8A8;border:1rpx solid #E8E0D0;border-radius:40rpx;padding:14rpx 32rpx;font-size:26rpx;}
.radius-control{padding:8rpx 40rpx 0;flex-shrink:0;}
.radius-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:4rpx;font-size:28rpx;color:#4A3728;}
.radius-val{color:#FFA07A;font-weight:700;}
.s-ends{display:flex;justify-content:space-between;font-size:20rpx;color:#C4B8A8;margin-top:2rpx;}
.settings{padding:8rpx 40rpx 4rpx;flex-shrink:0;}
.s-item{margin-bottom:10rpx;}
.s-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:4rpx;font-size:28rpx;color:#4A3728;}
.s-val{color:#FFA07A;font-weight:700;}
.btn-main{background:linear-gradient(135deg,#FFDD75,#FFC850);color:#4A3728;border:none;border-radius:40rpx;padding:18rpx 56rpx;font-size:30rpx;font-weight:700;margin:8rpx 40rpx 40rpx;box-shadow:0 4rpx 16rpx rgba(255,200,80,0.25);flex-shrink:0;}
</style>
