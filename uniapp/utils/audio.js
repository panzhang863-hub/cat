/**
 * 音频工具：音效 + 背景音乐
 * 微信小程序用 InnerAudioContext；本地 WAV 放 static/audio/，可随时换成同名 mp3。
 */

const AUDIO_BASE = '/static/audio/';

const _sfx = {};   // 每个音效一个实例，避免快速连点互相打断
let _bgm = null;

function playSfx(name) {
  if (!name) return;
  try {
    let ctx = _sfx[name];
    if (!ctx) {
      ctx = uni.createInnerAudioContext();
      ctx.src = AUDIO_BASE + name + '.wav';
      ctx.volume = 0.6;
      _sfx[name] = ctx;
    }
    ctx.stop();
    ctx.play();
  } catch (e) {
    // 音频失败不影响主流程
  }
}

const BGM_KEY = 'catchcat_bgm';

function isBgmOn() {
  return uni.getStorageSync(BGM_KEY) !== '0'; // 默认开
}

function playBgm(name = 'bgm-lobby') {
  try {
    if (!isBgmOn()) return;
    if (!_bgm) {
      _bgm = uni.createInnerAudioContext();
      _bgm.src = AUDIO_BASE + name + '.wav';
      _bgm.loop = true;
      _bgm.volume = 0.35;
    }
    _bgm.play();
  } catch (e) {}
}

function stopBgm() {
  try { if (_bgm) _bgm.stop(); } catch (e) {}
}

function toggleBgm() {
  const on = !isBgmOn();
  uni.setStorageSync(BGM_KEY, on ? '1' : '0');
  if (on) playBgm(); else stopBgm();
  return on;
}

export { playSfx, playBgm, stopBgm, toggleBgm, isBgmOn };
