/**
 * 游戏逻辑引擎（纯内存版）
 * - Geofence 越界判定
 * - 抓捕距离检测
 * - 查看位置管理
 * - 游戏状态机
 */

const { isInsidePolygon, getDistance } = require('../utils/geo');
const config = require('../config');

let store = null;
let broadcast = null;

function setStore(s) { store = s; }
function setBroadcast(fn) { broadcast = fn; }

// ── 处理位置上报 ──
async function handlePositionUpdate(roomCode, openId, position) {
  if (!store) return;

  const stateKey = `game:${roomCode}:state`;
  const posKey   = `game:${roomCode}:positions`;
  const elimKey  = `game:${roomCode}:eliminated`;

  const status = await store.hget(stateKey, 'status');
  if (status !== 'playing') return;

  const isEliminated = await store.sismember(elimKey, openId);
  if (isEliminated) return;

  const zoneJson = await store.hget(stateKey, 'zoneBoundary');
  if (!zoneJson) return;
  const zoneBoundary = JSON.parse(zoneJson);

  // 1. 越界检测
  if (zoneBoundary.length >= 3) {
    const inside = isInsidePolygon(position, zoneBoundary);
    console.log(`[位置] ${openId} @ ${position.lat},${position.lng} 界内=${inside} 区域首点=${zoneBoundary[0].lat},${zoneBoundary[0].lng}`);
    if (!inside) {
      await eliminatePlayer(roomCode, openId, 'out_of_bounds');
      return;
    }
  }

  // 2. 更新位置
  await store.hset(posKey, openId, JSON.stringify({ lat: position.lat, lng: position.lng, ts: Date.now() }));

  // 3. 寻找者检测附近躲藏者
  const roleStr = await store.hget(`game:${roomCode}:roles`, openId);
  if (roleStr) {
    const role = JSON.parse(roleStr);
    if (role === 'seeker') await checkCaptureOpportunities(roomCode, openId, position);
  }

  // 4. 广播位置
  await broadcastPositions(roomCode);
}

// ── 检测抓捕机会 ──
async function checkCaptureOpportunities(roomCode, seekerId, seekerPos) {
  const posKey    = `game:${roomCode}:positions`;
  const rolesKey  = `game:${roomCode}:roles`;
  const elimKey   = `game:${roomCode}:eliminated`;
  const captureKey = `game:${roomCode}:capture`;

  const radiusStr = await store.hget(`game:${roomCode}:state`, 'captureRadius');
  const radius = radiusStr ? parseInt(radiusStr) : config.game.defaultCaptureRadius;

  const allPositions = await store.hgetall(posKey);
  if (!allPositions) return;

  for (const [playerId, posJson] of Object.entries(allPositions)) {
    if (playerId === seekerId) continue;

    const roleStr = await store.hget(rolesKey, playerId);
    const playerRole = roleStr ? JSON.parse(roleStr) : '';
    if (playerRole !== 'hider') continue;

    const eliminated = await store.sismember(elimKey, playerId);
    if (eliminated) continue;

    const inCapture = await store.hexists(captureKey, playerId);
    if (inCapture) continue;

    const pos = JSON.parse(posJson);
    const dist = getDistance(seekerPos, pos);

    if (dist <= radius) {
      const info = await getPlayerInfo(roomCode, playerId);
      broadcast(roomCode, {
        type: 'capture_opportunity',
        data: {
          target: { openId: playerId, nickName: info.nickName, distance: Math.round(dist) },
          expiresIn: config.game.captureWindow,
        }
      }, [seekerId]);

      await store.hset(captureKey, playerId, JSON.stringify({ seekerId, ts: Date.now() }));
      await store.expire(captureKey, config.game.captureWindow + 5);
    }
  }
}

// ── 确认抓捕 ──
async function confirmCapture(roomCode, seekerId, targetOpenId) {
  const captureKey = `game:${roomCode}:capture`;

  const captureStr = await store.hget(captureKey, targetOpenId);
  if (!captureStr) return { success: false, reason: '窗口已过期' };

  const capture = JSON.parse(captureStr);
  if (capture.seekerId !== seekerId) return { success: false, reason: '不是你的目标' };
  if (Date.now() - capture.ts > config.game.captureWindow * 1000) {
    await store.hdel(captureKey, targetOpenId);
    return { success: false, reason: '确认超时' };
  }

  await eliminatePlayer(roomCode, targetOpenId, 'captured', seekerId);
  await store.hdel(captureKey, targetOpenId);

  return { success: true };
}

// ── 淘汰玩家 ──
async function eliminatePlayer(roomCode, openId, reason, bySeekerId) {
  await store.sadd(`game:${roomCode}:eliminated`, openId);

  broadcast(roomCode, {
    type: 'player_eliminated',
    data: { openId, reason, bySeekerId, ts: Date.now() }
  });

  await checkGameEnd(roomCode);
}

// ── 查看位置 ──
async function usePeek(roomCode, seekerId) {
  const rolesKey = `game:${roomCode}:roles`;
  const posKey   = `game:${roomCode}:positions`;
  const elimKey  = `game:${roomCode}:eliminated`;
  const stateKey = `game:${roomCode}:state`;

  const status = await store.hget(stateKey, 'status');
  if (status !== 'playing') return { success: false, reason: '游戏未进行' };

  const roleStr = await store.hget(rolesKey, seekerId);
  const role = roleStr ? JSON.parse(roleStr) : '';
  if (role !== 'seeker') return { success: false, reason: '仅寻找者可用' };

  const peeksStr = await store.hget(`game:${roomCode}:peeks`, seekerId);
  const remaining = peeksStr ? parseInt(peeksStr) : 0;
  if (remaining <= 0) return { success: false, reason: '无剩余次数' };

  await store.hincrby(`game:${roomCode}:peeks`, seekerId, -1);

  // 同步更新游戏文档
  const game = store.findOne({ roomCode });
  if (game) { const p = game.players.find(pp => pp.openId === seekerId); if (p) { p.peekRemaining = Math.max(0, (p.peekRemaining || 0) - 1); game.save(); } }

  const allPositions = await store.hgetall(posKey) || {};
  const hiders = [];
  // 兜底坐标：区域中心
  let fallLat=0,fallLng=0;
  try{const zb=JSON.parse(await store.hget(stateKey,'zoneBoundary')||'[]');if(zb.length>0){fallLat=zb[0].lat;fallLng=zb[0].lng;}}catch(e){}

  // 遍历所有玩家找躲藏者
  const allRoles = await store.hgetall(rolesKey) || {};
  for (const [pid, r] of Object.entries(allRoles)) {
    const pr = r ? JSON.parse(r) : '';
    if (pr !== 'hider') continue;
    const eliminated = await store.sismember(elimKey, pid);
    if (eliminated) continue;

    const posJson = allPositions[pid];
    const pos = posJson ? JSON.parse(posJson) : {lat:fallLat, lng:fallLng};
    const info = await getPlayerInfo(roomCode, pid);
    hiders.push({ openId: pid, nickName: info.nickName, lat: pos.lat||fallLat, lng: pos.lng||fallLng });
  }
  console.log(`[peek] 找到 ${hiders.length} 个躲藏者: ${hiders.map(h=>`${h.nickName}@${h.lat},${h.lng}`).join(' | ')}`);

  await store.set(`game:${roomCode}:peek_active`, '1', 'EX', config.game.peekDuration);

  const seekers = [];
  for (const [pid, r] of Object.entries(allRoles || {})) {
    if (JSON.parse(r) === 'seeker') seekers.push(pid);
  }

  broadcast(roomCode, {
    type: 'peek_result',
    data: { hiders, remainingPeeks: remaining - 1, expiresIn: config.game.peekDuration }
  }, seekers);

  setTimeout(() => {
    broadcast(roomCode, { type: 'peek_expired', data: {} }, seekers);
  }, config.game.peekDuration * 1000);

  return { success: true, hidersFound: hiders.length, remainingPeeks: remaining - 1 };
}

// ── 检查游戏结束 ──
async function checkGameEnd(roomCode) {
  const rolesKey = `game:${roomCode}:roles`;
  const elimKey  = `game:${roomCode}:eliminated`;

  const allRoles = await store.hgetall(rolesKey);
  if (!allRoles) return;

  let hidersTotal = 0, hidersAlive = 0;
  let seekersTotal = 0, seekersAlive = 0;
  for (const [pid, r] of Object.entries(allRoles)) {
    const role = JSON.parse(r);
    const eliminated = await store.sismember(elimKey, pid);
    if (role === 'hider') {
      hidersTotal++;
      if (!eliminated) hidersAlive++;
    } else if (role === 'seeker') {
      seekersTotal++;
      if (!eliminated) seekersAlive++;
    }
  }

  if (hidersAlive === 0 && hidersTotal > 0) {
    await endGame(roomCode, 'seekers');   // 所有鼠鼠被抓/退出 → 猫猫胜
  } else if (seekersAlive === 0 && seekersTotal > 0) {
    await endGame(roomCode, 'hiders');    // 所有猫猫退出 → 鼠鼠胜
  }
}

// ── 结束游戏 ──
async function endGame(roomCode, winner) {
  await store.hset(`game:${roomCode}:state`, 'status', 'ended');
  await store.hset(`game:${roomCode}:state`, 'winner', winner);

  const game = store.findOne({ roomCode });
  if (game) {
    const startTime = game.startedAt ? new Date(game.startedAt).getTime() : Date.now();
    game.status = 'ended';
    game.winner = winner;
    game.endedAt = new Date();
    game.duration = Math.floor((Date.now() - startTime) / 1000);

    const eliminatedList = await store.smembers(`game:${roomCode}:eliminated`);
    for (const p of game.players) {
      if (eliminatedList.includes(p.openId)) p.status = 'eliminated';
    }
    await game.save();
  }

  broadcast(roomCode, { type: 'game_ended', data: { winner, ts: Date.now() } });

  // 延迟清理
  setTimeout(async () => {
    const keys = await store.keys(`game:${roomCode}:*`);
    for (const k of keys) await store.del(k);
  }, 5 * 60000);
}

// ── 广播位置 ──
async function broadcastPositions(roomCode) {
  const rolesKey = `game:${roomCode}:roles`;
  const posKey   = `game:${roomCode}:positions`;
  const elimKey  = `game:${roomCode}:eliminated`;
  const peekActive = await store.get(`game:${roomCode}:peek_active`);

  const allPositions = await store.hgetall(posKey);
  const allRoles     = await store.hgetall(rolesKey);
  if (!allPositions || !allRoles) return;

  for (const [playerId, roleStr] of Object.entries(allRoles)) {
    const role = JSON.parse(roleStr);
    const visible = [];

    for (const [pid, posJson] of Object.entries(allPositions)) {
      const eliminated = await store.sismember(elimKey, pid);
      if (eliminated) continue;

      const pos = JSON.parse(posJson);

      if (role === 'seeker') {
        // 寻找者：能看到自己 + 其他寻找者 + peek时看到所有躲藏者
        const pidRole = JSON.parse(allRoles[pid] || '""');
        if (pid === playerId || pidRole === 'seeker' || peekActive) {
          const info = await getPlayerInfo(roomCode, pid);
          visible.push({ openId: pid, nickName: info.nickName, lat: pos.lat, lng: pos.lng, role: pidRole });
        }
      } else {
        // 躲藏者：能看到自己 + 其他躲藏者 + 寻找者（鼠鼠能一直看到猫猫）
        const pidRole = JSON.parse(allRoles[pid] || '""');
        if (pid === playerId || pidRole === 'hider' || pidRole === 'seeker') {
          const info = await getPlayerInfo(roomCode, pid);
          visible.push({ openId: pid, nickName: info.nickName, lat: pos.lat, lng: pos.lng, role: pidRole });
        }
      }
    }

    console.log(`[广播] 给 ${playerId}(${role}) 发 ${visible.length} 个位置: ${visible.map(v=>`${v.openId.slice(0,8)}@${v.lat.toFixed(4)},${v.lng.toFixed(4)}`).join(' | ')}`);
    broadcast(roomCode, { type: 'positions_sync', data: { players: visible } }, [playerId]);
  }
}

// ── 获取玩家信息 ──
async function getPlayerInfo(roomCode, openId) {
  const cached = await store.hget(`game:${roomCode}:playerInfo`, openId);
  if (cached) return JSON.parse(cached);

  const game = store.findOne({ roomCode });
  if (game) {
    const player = game.players.find(p => p.openId === openId);
    if (player) {
      const info = { nickName: player.nickName, avatarUrl: player.avatarUrl };
      await store.hset(`game:${roomCode}:playerInfo`, openId, JSON.stringify(info));
      return info;
    }
  }
  return { nickName: '未知玩家', avatarUrl: '' };
}

// ── 初始化游戏 Redis 数据 ──
async function initGameState(roomCode, gameData) {
  // 清理上一局残留状态（positions/eliminated/capture/peek_active 等），避免重开后串数据
  const oldKeys = await store.keys(`game:${roomCode}:*`);
  for (const k of oldKeys) await store.del(k);

  const stateKey = `game:${roomCode}:state`;
  const rolesKey = `game:${roomCode}:roles`;
  const peeksKey = `game:${roomCode}:peeks`;

  await store.hset(stateKey, 'status', 'preparing');
  await store.hset(stateKey, 'captureRadius', String(gameData.config.captureRadius || config.game.defaultCaptureRadius));
  await store.hset(stateKey, 'zoneBoundary', JSON.stringify(gameData.config.zoneBoundary || []));

  for (const p of gameData.players) {
    await store.hset(rolesKey, p.openId, JSON.stringify(p.role));
    if (p.role === 'seeker') {
      await store.hset(peeksKey, p.openId, String(gameData.config.peekCount || config.game.defaultPeekCount));
    }
  }

  // 准备阶段结束后切换为 playing
  setTimeout(async () => {
    await store.hset(stateKey, 'status', 'playing');
    // 同步更新游戏文档
    const game = store.findOne({ roomCode });
    if (game) { game.status = 'playing'; await game.save(); }
    broadcast(roomCode, {
      type: 'game_started',
      data: { config: gameData.config }
    });

    // 定时超时结束
    const duration = (gameData.config.duration || config.game.defaultDuration) * 1000;
    setTimeout(async () => {
      const status = await store.hget(stateKey, 'status');
      if (status === 'playing') {
        await endGame(roomCode, 'hiders');
      }
    }, duration);
  }, config.game.prepareTime * 1000);
}

module.exports = {
  setStore,
  setBroadcast,
  handlePositionUpdate,
  confirmCapture,
  usePeek,
  eliminatePlayer,
  checkGameEnd,
  endGame,
  initGameState,
};
