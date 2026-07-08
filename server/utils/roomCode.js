/**
 * 生成 6 位纯数字房间码
 */
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

module.exports = { generateRoomCode };
