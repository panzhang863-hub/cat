/**
 * 纯内存存储引擎
 * 替代 MongoDB + Redis，程序重启数据消失
 * 生产环境切换回真实数据库即可，API 接口不变
 */

class MemoryStore {
  constructor() {
    // 游戏主存储: roomCode → gameDoc
    this.games = new Map();

    // KV 存储: key → { value, expiresAt }
    this.kv = new Map();

    // Hash 存储: key → Map
    this.hashes = new Map();

    // Set 存储: key → Set
    this.sets = new Map();

    // 每 30 秒清理过期 key
    this._cleanupTimer = setInterval(() => this._cleanup(), 30000);
  }

  // ==================== Game（替代 MongoDB） ====================

  create(gameData) {
    // 生成 roomCode（如果没提供）
    if (!gameData.roomCode) {
      gameData.roomCode = this._genCode();
    }
    // 生成 _id
    const doc = {
      _id: 'game_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      ...gameData,
      createdAt: gameData.createdAt || new Date(),
      startedAt: gameData.startedAt || null,
      endedAt: gameData.endedAt || null,
      players: gameData.players || [],
      status: gameData.status || 'waiting',
      config: gameData.config || {
        duration: 900,
        peekCount: 3,
        captureRadius: 15,
        zoneBoundary: [],
      },
      winner: gameData.winner || '',
      duration: gameData.duration || 0,
      playerCount: gameData.playerCount || 0,
    };
    this.games.set(doc.roomCode, doc);
    return doc;
  }

  findOne(query) {
    for (const [, game] of this.games) {
      if (this._match(game, query)) {
        // 返回一个类似 Mongoose document 的对象（带 save 方法）
        return this._wrap(game);
      }
    }
    return null;
  }

  findById(id) {
    for (const [, game] of this.games) {
      if (game._id === id) return this._wrap(game);
    }
    return null;
  }

  find(query) {
    const results = [];
    for (const [, game] of this.games) {
      if (this._match(game, query)) {
        results.push(this._wrap(game));
      }
    }
    return {
      sort: () => this._cursor(results),
      select: () => this._cursor(results),
      skip: (n) => this._cursor(results.slice(n)),
      limit: (n) => this._cursor(results.slice(0, n)),
    };
  }

  _cursor(results) {
    return {
      sort: () => ({ skip: () => ({ limit: () => Promise.resolve(results) }) }),
      select: () => ({ sort: () => ({ skip: () => ({ limit: () => Promise.resolve(results) }) }) }),
      skip: () => ({ sort: () => ({ limit: () => Promise.resolve(results) }) }),
      limit: () => Promise.resolve(results),
    };
  }

  countDocuments(query) {
    let count = 0;
    for (const [, game] of this.games) {
      if (this._match(game, query)) count++;
    }
    return Promise.resolve(count);
  }

  deleteOne(query) {
    for (const [key, game] of this.games) {
      if (this._match(game, query)) {
        this.games.delete(key);
        return Promise.resolve({ deletedCount: 1 });
      }
    }
    return Promise.resolve({ deletedCount: 0 });
  }

  // ==================== KV（替代 Redis String） ====================

  set(key, value, mode, ttl) {
    let expiresAt = null;
    if (mode === 'EX' && ttl) {
      expiresAt = Date.now() + ttl * 1000;
    }
    this.kv.set(key, { value: String(value), expiresAt });
    return Promise.resolve('OK');
  }

  get(key) {
    const entry = this.kv.get(key);
    if (!entry) return Promise.resolve(null);
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.kv.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  del(...keys) {
    for (const k of keys) this.kv.delete(k);
    return Promise.resolve(keys.length);
  }

  expire(key, seconds) {
    const entry = this.kv.get(key);
    if (!entry) return Promise.resolve(0);
    entry.expiresAt = Date.now() + seconds * 1000;
    return Promise.resolve(1);
  }

  keys(pattern) {
    const result = [];
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.kv.keys()) {
      if (regex.test(key)) result.push(key);
    }
    for (const key of this.hashes.keys()) {
      if (regex.test(key)) result.push(key);
    }
    for (const key of this.sets.keys()) {
      if (regex.test(key)) result.push(key);
    }
    return Promise.resolve(result);
  }

  // ==================== Hash（替代 Redis Hash） ====================

  async hset(key, field, value) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    this.hashes.get(key).set(field, String(value));
    return Promise.resolve(1);
  }

  async hget(key, field) {
    const hash = this.hashes.get(key);
    if (!hash) return Promise.resolve(null);
    return Promise.resolve(hash.get(field) || null);
  }

  async hgetall(key) {
    const hash = this.hashes.get(key);
    if (!hash) return Promise.resolve(null);
    const obj = {};
    for (const [k, v] of hash) obj[k] = v;
    return Promise.resolve(obj);
  }

  async hdel(key, field) {
    const hash = this.hashes.get(key);
    if (!hash) return Promise.resolve(0);
    const existed = hash.has(field);
    hash.delete(field);
    return Promise.resolve(existed ? 1 : 0);
  }

  async hincrby(key, field, increment) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const hash = this.hashes.get(key);
    const current = parseInt(hash.get(field) || '0');
    const next = current + increment;
    hash.set(field, String(next));
    return Promise.resolve(next);
  }

  async hexists(key, field) {
    const hash = this.hashes.get(key);
    if (!hash) return Promise.resolve(0);
    return Promise.resolve(hash.has(field) ? 1 : 0);
  }

  // ==================== Set（替代 Redis Set） ====================

  async sadd(key, member) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    this.sets.get(key).add(member);
    return Promise.resolve(1);
  }

  async sismember(key, member) {
    const set = this.sets.get(key);
    if (!set) return Promise.resolve(0);
    return Promise.resolve(set.has(member) ? 1 : 0);
  }

  async smembers(key) {
    const set = this.sets.get(key);
    if (!set) return Promise.resolve([]);
    return Promise.resolve(Array.from(set));
  }

  // ==================== 昵称管理 ====================

  _nicknames = new Set();

  isNicknameTaken(name) {
    return this._nicknames.has(name);
  }

  registerNickname(name) {
    this._nicknames.add(name);
  }

  // ==================== 工具方法 ====================

  _match(doc, query) {
    for (const [key, val] of Object.entries(query)) {
      if (key === '_id') {
        if (doc._id !== val) return false;
      } else if (key === 'roomCode') {
        if (doc.roomCode !== val) return false;
      } else if (key === 'status') {
        if (typeof val === 'object' && val.$ne) {
          if (doc.status === val.$ne) return false;
        } else {
          if (doc.status !== val) return false;
        }
      } else if (key === 'players.openId') {
        if (!doc.players || !doc.players.some(p => p.openId === val)) return false;
      }
    }
    return true;
  }

  _wrap(doc) {
    // 直接返回原对象，修改会生效（因为是引用）
    if (!doc) return null;
    doc.save = () => Promise.resolve(doc);
    doc.toObject = () => ({ ...doc });
    return doc;
  }

  _genCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.kv) {
      if (entry.expiresAt && now > entry.expiresAt) this.kv.delete(key);
    }
  }

  destroy() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
  }
}

// 全局单例
const store = new MemoryStore();

module.exports = store;
