// 유틸리티 함수들

// 이미지 경로 가져오기 함수
function getImagePath(filename) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/img/${filename}`;
}

// 거리 계산 (Haversine 공식, km 단위)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반경 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 지도 레벨에 따른 반경 계산 (km)
function getRadiusByLevel(level) {
  switch (level) {
    case 1: case 2: case 3: return 1;   // 매우 확대 시 최소 1km
    case 4: return 2;
    case 5: return 3;
    case 6: return 6;
    case 7: return 10;
    case 8: return 15;
    case 9: return 20;
    case 10: return 30;
    default: return level < 5 ? 1 : 50;  // 확대 시 최소 1km, 축소 시 50km
  }
}

// 마커 이미지 생성
function createMarkerImage(color) {
  const src = color === 'green' ? getImagePath('g.png') 
            : color === 'red' ? getImagePath('r.png') 
            : getImagePath('o.png');
  return new kakao.maps.MarkerImage(src, new kakao.maps.Size(34, 34), {
    offset: new kakao.maps.Point(17, 34)
  });
}

// 충전기 타입 별칭 매핑
const CHARGER_TYPE_ALIAS = {
  "완속": ["AC완속", "AC3상"],
  "급속": ["DC콤보", "DC차데모", "DC콤보(완속)"],
  "AC완속": ["AC완속", "AC3상"],
  "AC3상": ["AC3상", "AC완속"],
  "DC콤보": ["DC콤보", "DC콤보(완속)"],
  "DC차데모": ["DC차데모"],
  "DC콤보(완속)": ["DC콤보(완속)", "DC콤보"],
  "NACS": ["NACS"]
};

// 충전기 타입 매칭 확인
function matchChargerType(chargerType, selectedTypes) {
  if (selectedTypes.includes("전체")) return true;
  return selectedTypes.some(type => {
    const aliases = CHARGER_TYPE_ALIAS[type] || [type];
    return aliases.some(alias => chargerType.includes(alias));
  });
}

