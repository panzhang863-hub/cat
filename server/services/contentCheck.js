const https = require('https');
const config = require('../config');

let accessToken = '';
let tokenExpireTime = 0;

function getAccessToken() {
  return new Promise((resolve, reject) => {
    if (accessToken && Date.now() < tokenExpireTime) {
      return resolve(accessToken);
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wechatAppId}&secret=${config.wechatAppSecret}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            accessToken = json.access_token;
            tokenExpireTime = Date.now() + (json.expires_in - 300) * 1000;
            resolve(accessToken);
          } else {
            reject(new Error(json.errmsg || 'token failed'));
          }
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function msgSecCheck(openid, content) {
  return new Promise(async (resolve) => {
    try {
      const token = await getAccessToken();
      const postData = JSON.stringify({ openid, scene: 1, version: 2, content });
      const options = {
        hostname: 'api.weixin.qq.com',
        path: `/wxa/msg_sec_check?access_token=${token}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };
      const req = https.request(options, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const r = JSON.parse(d);
            if (r.errcode === 0) {
              console.log('[安全] 昵称通过:', content);
              resolve({ ok: true });
            } else if (r.errcode === 87014) {
              console.log('[安全] 昵称违规:', content, r.errmsg);
              resolve({ ok: false, errmsg: '昵称包含违规内容' });
            } else {
              // 其他错误（openid无效、token失效等）非内容违规，放行
              console.log('[安全] 接口错误，放行:', r.errcode, r.errmsg);
              resolve({ ok: true });
            }
          } catch(e) { resolve({ ok: true }); }
        });
      });
      req.on('error', (e) => { console.log('[安全] 请求失败，放行'); resolve({ ok: true }); });
      req.write(postData);
      req.end();
    } catch(e) {
      console.log('[安全] 异常，放行:', e.message);
      resolve({ ok: true });
    }
  });
}

module.exports = { msgSecCheck };
