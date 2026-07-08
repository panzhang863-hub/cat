/**
 * 地理计算工具模块
 * - 射线法点是否在多边形内
 * - Haversine 两点距离计算
 */

/**
 * 射线法判断点是否在多边形内部
 * @param {Object} point  { lat, lng }
 * @param {Array}  polygon [{ lat, lng }, ...]
 * @returns {boolean}
 */
function isInsidePolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    if ((yi > point.lat) !== (yj > point.lat) &&
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Haversine 公式计算两点距离（米）
 * @param {Object} p1 { lat, lng }
 * @param {Object} p2 { lat, lng }
 * @returns {number} 距离（米）
 */
function getDistance(p1, p2) {
  const R = 6371000; // 地球半径（米）
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { isInsidePolygon, getDistance };
