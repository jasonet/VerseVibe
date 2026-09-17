/**
 * 天气与地理定位服务配置
 *
 * 默认使用 Open-Meteo 开源免 Key 方案（免费、全球可用、支持中文）。
 * 同时预留了国内商业天气服务（和风天气 QWeather / 高德地图 AMap）的 API Key 槽位。
 */

export const WEATHER_API_CONFIG = {
  // 当前天气服务提供商: "open-meteo" | "qweather" | "amap"
  provider: "open-meteo",

  // 和风天气 (QWeather) 配置 (申请地址: https://dev.qweather.com/)
  // 填入商业或免费开发版 API Key 即可切换至和风高精度天气
  qweather: {
    apiKey: "", // 请在此处填入和风天气 API Key
    apiHost: "https://devapi.qweather.com/v7",
    geoHost: "https://geoapi.qweather.com/v2",
  },

  // 高德地图 (AMap) Web服务配置 (申请地址: https://console.amap.com/)
  // 填入高德 Web 服务 Key 即可激活高德精准逆地理编码与城市天气
  amap: {
    apiKey: "", // 请在此处填入高德 Web服务 API Key
    apiHost: "https://restapi.amap.com/v3",
  },

  // Open-Meteo 开源免 Key 接口
  openMeteo: {
    forecastUrl: "https://api.open-meteo.com/v1/forecast",
    geocodingUrl: "https://geocoding-api.open-meteo.com/v1/search",
  },

  // BigDataCloud 逆地理编码公开接口
  bigDataCloud: {
    reverseGeocodeUrl: "https://api.bigdatacloud.net/data/reverse-geocode-client",
  },
};

/**
 * WMO 世界气象组织通用天气代码中文映射表
 */
export const WMO_WEATHER_CODES = Object.freeze({
  0: { label: "晴朗", icon: "☀️", condition: "clear" },
  1: { label: "大部晴朗", icon: "🌤️", condition: "mostly-clear" },
  2: { label: "局部多云", icon: "⛅", condition: "partly-cloudy" },
  3: { label: "阴天", icon: "☁️", condition: "overcast" },
  45: { label: "有雾", icon: "🌫️", condition: "fog" },
  48: { label: "冻雾", icon: "🌫️", condition: "rime-fog" },
  51: { label: "轻微毛毛雨", icon: "🌦️", condition: "light-drizzle" },
  53: { label: "毛毛细雨", icon: "🌧️", condition: "moderate-drizzle" },
  55: { label: "浓密毛毛雨", icon: "🌧️", condition: "dense-drizzle" },
  56: { label: "轻微冻雨", icon: "🌧️", condition: "light-freezing-drizzle" },
  57: { label: "密冻雨", icon: "🌧️", condition: "dense-freezing-drizzle" },
  61: { label: "小雨", icon: "🌧️", condition: "slight-rain" },
  63: { label: "中雨", icon: "🌧️", condition: "moderate-rain" },
  65: { label: "大雨", icon: "🌧️", condition: "heavy-rain" },
  66: { label: "轻冻雨", icon: "🌧️", condition: "light-freezing-rain" },
  67: { label: "暴冻雨", icon: "🌧️", condition: "heavy-freezing-rain" },
  71: { label: "小雪", icon: "🌨️", condition: "slight-snow" },
  73: { label: "中雪", icon: "🌨️", condition: "moderate-snow" },
  75: { label: "大雪暴雪", icon: "❄️", condition: "heavy-snow" },
  77: { label: "雪粒", icon: "🌨️", condition: "snow-grains" },
  80: { label: "小阵雨", icon: "🌦️", condition: "slight-rain-showers" },
  81: { label: "阵雨", icon: "🌧️", condition: "moderate-rain-showers" },
  82: { label: "暴阵雨", icon: "⛈️", condition: "violent-rain-showers" },
  85: { label: "小阵雪", icon: "🌨️", condition: "slight-snow-showers" },
  86: { label: "大阵雪", icon: "❄️", condition: "heavy-snow-showers" },
  95: { label: "雷阵雨", icon: "⛈️", condition: "thunderstorm" },
  96: { label: "雷阵雨伴轻冰雹", icon: "⛈️", condition: "thunderstorm-hail" },
  99: { label: "强雷雨伴重冰雹", icon: "⛈️", condition: "heavy-thunderstorm-hail" },
});
