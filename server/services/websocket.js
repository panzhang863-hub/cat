/**
 * WebSocket 服务
 * - 连接管理
 * - 房间频道广播
 * - 消息路由
 */

const WebSocket = require('ws');
const gameEngine = require('./gameEngine');

let wss = null;
// 客户端连接映射: openId → { ws, roomCode }
const clients = new Map();

function init(server) {
  wss = new WebSocket.Server({ server });

  // 注入广播函数到游戏引擎
  gameEngine.setBroadcast(broadcastToRoom);

  wss.on('connection', (ws, req) => {
    // 从 URL 参数获取身份
    const url = new URL(req.url, 'http://localhost');
    const roomCode = url.searchParams.get('room');
    const openId   = url.searchParams.get('openId');
    const token    = url.searchParams.get('token'); // 简单鉴权

    if (!roomCode || !openId) {
      ws.close(4001, 'Missing room or openId');
      return;
    }

    // 存储连接
    const key = `${roomCode}:${openId}`;
    clients.set(key, { ws, roomCode, openId });

    console.log(`[WS] 连接: ${openId} → 房间 ${roomCode}`);

    // 通知房间其他玩家
    broadcastToRoom(roomCode, {
      type: 'player_online',
      data: { openId, ts: Date.now() }
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(roomCode, openId, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', data: { message: 'Invalid JSON' } }));
      }
    });

    ws.on('close', () => {
      clients.delete(key);
      console.log(`[WS] 断开: ${openId} ← 房间 ${roomCode}`);
      broadcastToRoom(roomCode, {
        type: 'player_offline',
        data: { openId, ts: Date.now() }
      });
    });

    ws.on('error', (err) => {
      console.error(`[WS] 错误 ${openId}:`, err.message);
    });
  });

  console.log('[WS] WebSocket 服务已启动');
  return wss;
}

/**
 * 消息路由
 */
function handleMessage(roomCode, openId, msg) {
  switch (msg.type) {
    case 'position_update':
      gameEngine.handlePositionUpdate(roomCode, openId, msg.data);
      break;

    case 'use_peek':
      gameEngine.usePeek(roomCode, openId).then(result => {
        if (!result.success) {
          sendToPlayer(roomCode, openId, {
            type: 'error',
            data: { message: result.reason }
          });
        }
      });
      break;

    case 'player_quit':
      broadcastToRoom(roomCode, {
        type: 'player_quit',
        data: { openId, nickName: msg.data.nickName || '玩家', ts: Date.now() }
      });
      break;

    case 'confirm_capture':
      gameEngine.confirmCapture(roomCode, openId, msg.data.targetOpenId)
        .then(result => {
          if (!result.success) {
            sendToPlayer(roomCode, openId, {
              type: 'error',
              data: { message: result.reason }
            });
          }
        });
      break;

    default:
      break;
  }
}

/**
 * 广播消息给房间内所有人
 */
function broadcastToRoom(roomCode, message, targetIds) {
  if (!wss) return;

  const payload = JSON.stringify(message);

  for (const [key, client] of clients) {
    if (client.roomCode !== roomCode) continue;
    if (client.ws.readyState !== WebSocket.OPEN) continue;

    // 如果指定了目标玩家，只发给目标
    if (targetIds && !targetIds.includes(client.openId)) continue;

    client.ws.send(payload);
  }
}

/**
 * 发送消息给指定玩家
 */
function sendToPlayer(roomCode, openId, message) {
  broadcastToRoom(roomCode, message, [openId]);
}

/**
 * 获取房间在线人数
 */
function getOnlineCount(roomCode) {
  let count = 0;
  for (const [, client] of clients) {
    if (client.roomCode === roomCode && client.ws.readyState === WebSocket.OPEN) {
      count++;
    }
  }
  return count;
}

module.exports = { init, broadcastToRoom, sendToPlayer, getOnlineCount };
