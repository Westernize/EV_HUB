// 마커 클러스터 및 지역 마커 관리

// clusterer 변수 (map.js에서 사용)
let clusterer = null;

// 지도 스케일 거리 계산 (미터 단위)
function getMapScaleDistance() {
    const map = typeof window.getMap === 'function' ? window.getMap() : null;
    if (!map) return Infinity;
    
    const bounds = map.getBounds();
    if (!bounds) return Infinity;
    
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    
    // 지도의 가로 너비 계산 (경도 차이를 이용)
    // 위도에 따라 경도 1도의 실제 거리가 달라지므로, 중심 위도를 사용
    const centerLat = (sw.getLat() + ne.getLat()) / 2;
    const lat1 = centerLat;
    const lat2 = centerLat;
    const lon1 = sw.getLng();
    const lon2 = ne.getLng();
    
    // Haversine 공식으로 거리 계산 (미터 단위)
    const R = 6371000; // 지구 반경 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) *
              Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // 미터 단위
    
    return distance;
}

// Delta Area 계산 (2023-car-ffeine-develop 방식)
window.getDeltaArea = function() {
    const map = typeof window.getMap === 'function' ? window.getMap() : null;
    if (!map) return 'medium';
    
    const bounds = map.getBounds();
    if (!bounds) return 'medium';
    
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const latitudeDelta = (ne.getLat() - sw.getLat()) / 2;
    const longitudeDelta = (ne.getLng() - sw.getLng()) / 2;
    const deltaArea = latitudeDelta * longitudeDelta;
    
    // 2023-car-ffeine-develop의 DELTA_AREA_BREAKPOINTS
    const DELTA_AREA_BREAKPOINTS = {
        small: 0.0000085,
        medium: 0.0005,
        large: 0.137
    };
    
    if (deltaArea >= DELTA_AREA_BREAKPOINTS.large) {
        return 'max';
    } else if (deltaArea >= DELTA_AREA_BREAKPOINTS.medium) {
        return 'large';
    } else if (deltaArea >= DELTA_AREA_BREAKPOINTS.small) {
        return 'medium';
    } else {
        return 'small';
    }
};

// 지도 스케일 거리 계산 함수 전역 노출
window.getMapScaleDistance = getMapScaleDistance;

// 클러스터 캐시 (성능 최적화)
const clusterCache = new Map();
const CACHE_DURATION = 5000; // 5초 캐시

// 클라이언트 사이드 클러스터 계산 (백엔드 API 호출 없이 즉시 반응!)
window.fetchClustersFromAPI = function() {
    const map = typeof window.getMap === 'function' ? window.getMap() : null;
    if (!map) return [];
    
    // 모든 레벨에서 클러스터 계산 가능 (Delta Area 기반으로 결정)
    const currentLevel = map.getLevel();
    
    // allStations가 없으면 빈 배열 반환 (데이터 로드 전에는 클러스터 표시 안 함)
    const allStations = window.allStations || [];
    if (!allStations || !Array.isArray(allStations) || allStations.length === 0) {
        // 데이터가 아직 로드되지 않았으면 조용히 빈 배열 반환 (에러 아님)
        console.warn('[fetchClustersFromAPI] allStations가 아직 로드되지 않았습니다.');
        return [];
    }
    
    // 지도 bounds가 안정화될 때까지 기다리기 (레벨 변경 시 위치가 변할 수 있음)
    // requestAnimationFrame을 사용하여 다음 프레임에서 계산 (지도 업데이트 완료 후)
    let center, bounds, sw, ne;
    try {
        center = map.getCenter();
        bounds = map.getBounds();
        if (!bounds || !center) {
            console.warn('[fetchClustersFromAPI] 지도 bounds가 아직 준비되지 않았습니다.');
            return [];
        }
        sw = bounds.getSouthWest();
        ne = bounds.getNorthEast();
        
        // bounds 유효성 검사
        if (!sw || !ne) {
            console.warn('[fetchClustersFromAPI] 지도 bounds가 유효하지 않습니다.');
            return [];
        }
    } catch (error) {
        console.error('[fetchClustersFromAPI] 지도 bounds 가져오기 실패:', error);
        return [];
    }
    
    // 중심점과 델타 계산
    const latitude = center.getLat();
    const longitude = center.getLng();
    const latitudeDelta = (ne.getLat() - sw.getLat()) / 2;
    const longitudeDelta = (ne.getLng() - sw.getLng()) / 2;
    
    // 델타 유효성 검사 (너무 작거나 크면 안 됨)
    if (latitudeDelta <= 0 || longitudeDelta <= 0 || !isFinite(latitudeDelta) || !isFinite(longitudeDelta)) {
        console.warn('[fetchClustersFromAPI] 잘못된 델타 값:', { latitudeDelta, longitudeDelta });
        return [];
    }
    
    // 캐시 키 생성 (반올림하여 근사치로 캐싱)
    const cacheKey = `${Math.round(latitude * 100)}_${Math.round(longitude * 100)}_${currentLevel}_${Math.round(latitudeDelta * 1000)}_${Math.round(longitudeDelta * 1000)}`;
    
    // 캐시 확인
    const cached = clusterCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    
    // DELTA_MULTIPLE 조정 (레벨에 따라 동적으로)
    // 레벨 5는 확대된 상태이므로 델타를 더 크게 확장하여 범위 내 충전소가 충분히 포함되도록
    let DELTA_MULTIPLE;
    if (currentLevel === 5) {
        // 레벨 5는 확대된 상태이므로 델타를 더 크게 확장 (반경 문제 해결)
        DELTA_MULTIPLE = 3; // 2 → 3으로 증가
    } else if (currentLevel >= 6 && currentLevel <= 7) {
        DELTA_MULTIPLE = 2.5; // 레벨 6-7도 약간 확장
    } else {
        DELTA_MULTIPLE = 2; // 기본값
    }
    
    const expandedLatitudeDelta = latitudeDelta * DELTA_MULTIPLE;
    const expandedLongitudeDelta = longitudeDelta * DELTA_MULTIPLE;
    
    // 델타 확장 후 유효성 검사
    if (expandedLatitudeDelta <= 0 || expandedLongitudeDelta <= 0 || 
        !isFinite(expandedLatitudeDelta) || !isFinite(expandedLongitudeDelta)) {
        console.warn('[fetchClustersFromAPI] 확장된 델타 값이 유효하지 않음:', { 
            expandedLatitudeDelta, 
            expandedLongitudeDelta,
            originalLatitudeDelta: latitudeDelta,
            originalLongitudeDelta: longitudeDelta,
            DELTA_MULTIPLE
        });
        return [];
    }
    
    // 그리드 분할 수 조정 (레벨에 따라 동적으로 조정)
    // 레벨 5는 확대된 상태이므로 그리드를 더 세밀하게 분할
    let latitudeDivisionSize, longitudeDivisionSize;
    
    if (currentLevel >= 10) {
        latitudeDivisionSize = 5;
        longitudeDivisionSize = 5;
    } else if (currentLevel >= 8) {
        latitudeDivisionSize = 6;
        longitudeDivisionSize = 6;
    } else if (currentLevel >= 6) {
        latitudeDivisionSize = 7;
        longitudeDivisionSize = 7;
    } else if (currentLevel === 5) {
        // 레벨 5는 확대된 상태이므로 더 세밀한 그리드 사용 (클러스터가 제대로 생성되도록)
        // 하지만 델타를 크게 확장했으므로 그리드는 적당히 유지
        latitudeDivisionSize = 8;
        longitudeDivisionSize = 8;
    } else {
        // 레벨 6 이상 (이론적으로는 도달하지 않지만 안전을 위해)
        latitudeDivisionSize = 8;
        longitudeDivisionSize = 8;
    }
    
    // 클라이언트 사이드에서 클러스터 계산 (백엔드 API 호출 없이! 즉시 반응!)
    let clusters;
    try {
        clusters = calculateClustersClientSide(
            latitude,
            longitude,
            expandedLatitudeDelta,
            expandedLongitudeDelta,
            latitudeDivisionSize,
            longitudeDivisionSize
        );
        
        // 클러스터 계산 결과 로깅 (디버깅용)
        if (clusters.length === 0) {
            console.log(`[fetchClustersFromAPI] 클러스터 없음 - 레벨: ${currentLevel}, 원본 델타: ${latitudeDelta.toFixed(6)}, ${longitudeDelta.toFixed(6)}, 확장 델타: ${expandedLatitudeDelta.toFixed(6)}, ${expandedLongitudeDelta.toFixed(6)}, 배수: ${DELTA_MULTIPLE}, 그리드: ${latitudeDivisionSize}x${longitudeDivisionSize}`);
        } else {
            console.log(`[fetchClustersFromAPI] 클러스터 ${clusters.length}개 계산 완료 - 레벨: ${currentLevel}, 확장 델타: ${expandedLatitudeDelta.toFixed(6)}, ${expandedLongitudeDelta.toFixed(6)}, 배수: ${DELTA_MULTIPLE}`);
        }
    } catch (error) {
        console.error('[fetchClustersFromAPI] 클러스터 계산 중 오류:', error);
        return [];
    }
    
    // 캐시에 저장 (비동기로 처리하여 UI 블로킹 방지)
    requestAnimationFrame(() => {
        clusterCache.set(cacheKey, {
            data: clusters,
            timestamp: Date.now()
        });
        
        // 오래된 캐시 정리 (메모리 관리) - 비동기로 처리
        if (clusterCache.size > 50) {
            setTimeout(() => {
                const now = Date.now();
                for (const [key, value] of clusterCache.entries()) {
                    if (now - value.timestamp > CACHE_DURATION) {
                        clusterCache.delete(key);
                    }
                }
            }, 0);
        }
    });
    
    // 즉시 반환 (Promise 없이 동기적으로!)
    return clusters;
};

// 클라이언트 사이드 클러스터 계산 함수 (백엔드 로직 포팅 - 최적화!)
function calculateClustersClientSide(latitude, longitude, latitudeDelta, longitudeDelta, latitudeDivisionSize, longitudeDivisionSize) {
    // allStations 안전 체크
    const allStations = window.allStations || [];
    if (!allStations || !Array.isArray(allStations) || allStations.length === 0) {
        console.warn('[calculateClustersClientSide] allStations가 없습니다.');
        return [];
    }
    
    // 범위 계산
    const minLat = latitude - latitudeDelta;
    const maxLat = latitude + latitudeDelta;
    const minLng = longitude - longitudeDelta;
    const maxLng = longitude + longitudeDelta;
    
    // 그리드 크기 계산 (0으로 나누기 방지)
    if (maxLat <= minLat || maxLng <= minLng) {
        console.warn('[calculateClustersClientSide] 잘못된 범위:', { minLat, maxLat, minLng, maxLng });
        return [];
    }
    
    const latInterval = (maxLat - minLat) / latitudeDivisionSize;
    const lngInterval = (maxLng - minLng) / longitudeDivisionSize;
    
    // 그리드맵: key = "latIndex_lngIndex", value = {count, sumLat, sumLng}
    // Object 사용이 Map보다 빠를 수 있음 (작은 데이터셋)
    const gridMap = {};
    
    // 범위 필터링 및 그리드 할당 (최적화: 조기 종료)
    const stationsLength = allStations.length;
    let inRangeCount = 0;
    
    for (let i = 0; i < stationsLength; i++) {
        const station = allStations[i];
        const lat = station.lat;
        const lng = station.lng;
        
        // null 체크 및 범위 필터링 (조기 종료로 성능 향상)
        if (lat == null || lng == null) continue;
        if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue;
        
        inRangeCount++;
        
        // 그리드 인덱스 계산 (Math.floor 최적화)
        const latIndex = Math.max(0, Math.min(latitudeDivisionSize - 1, 
            ((lat - minLat) / latInterval) | 0)); // | 0은 Math.floor보다 빠름
        const lngIndex = Math.max(0, Math.min(longitudeDivisionSize - 1, 
            ((lng - minLng) / lngInterval) | 0));
        
        // 그리드 키 생성 (템플릿 리터럴보다 문자열 연결이 빠를 수 있음)
        const gridKey = latIndex + '_' + lngIndex;
        
        // 그리드맵 업데이트 (Object 사용으로 더 빠름)
        if (!gridMap[gridKey]) {
            gridMap[gridKey] = { count: 0, sumLat: 0, sumLng: 0 };
        }
        const grid = gridMap[gridKey];
        grid.count++;
        grid.sumLat += lat;
        grid.sumLng += lng;
    }
    
    // 범위 내 충전소가 없으면 로그 출력
    if (inRangeCount === 0) {
        console.log(`[calculateClustersClientSide] 범위 내 충전소 없음 - 전체: ${stationsLength}개, 범위: ${minLat.toFixed(4)}~${maxLat.toFixed(4)}, ${minLng.toFixed(4)}~${maxLng.toFixed(4)}`);
    }
    
    // 클러스터 리스트 생성 (실제 충전소들의 평균 위치 사용)
    const clusters = [];
    const gridKeys = Object.keys(gridMap);
    const gridKeysLength = gridKeys.length;
    
    for (let i = 0; i < gridKeysLength; i++) {
        const gridKey = gridKeys[i];
        const grid = gridMap[gridKey];
        
        if (grid.count > 0) {
            // 실제 충전소들의 평균 위치 계산 (더 자연스러운 배치)
            clusters.push({
                id: gridKey,
                latitude: grid.sumLat / grid.count,
                longitude: grid.sumLng / grid.count,
                count: grid.count
            });
        }
    }
    
    return clusters;
}

// 지역 마커 API 호출
window.fetchRegionsFromAPI = async function() {
    try {
        const response = await fetch('/api/ev/regions');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const regions = await response.json();
        console.log(`지역 마커 API: ${regions.length}개 지역 받음`);
        return regions;
    } catch (error) {
        console.error('지역 마커 API 호출 실패:', error);
        return [];
    }
};

// 지역 마커 저장 (레벨 변경 시 위치 업데이트용)
window.regionMarkers = window.regionMarkers || [];
window.regionData = window.regionData || [];

// 레벨별 오프셋 값 계산 함수
function getLevelOffset(currentLevel) {
    const levelOffsets = {
        1: 0.05,   // 레벨 1: 매우 확대 - 적게 이동
        2: 0.08,
        3: 0.12,
        4: 0.15,
        5: 0.18,
        6: 0.22,
        7: 0.25,
        8: 0.28,
        9: 0.32,
        10: 0.35,
        11: 0.38,
        12: 0.40,
        13: 0.42,
        14: 0.45   // 레벨 14: 매우 축소 - 많이 이동
    };
    return levelOffsets[currentLevel] || 0.25;
}

// 지역 마커 위치 업데이트 (레벨 변경 시 호출)
window.updateRegionMarkerPositions = function() {
    const map = typeof window.getMap === 'function' ? window.getMap() : null;
    if (!map || !window.regionMarkers || window.regionMarkers.length === 0) return;
    
    const currentLevel = map.getLevel();
    
    window.regionMarkers.forEach((overlay, index) => {
        if (overlay && window.regionData[index]) {
            const region = window.regionData[index];
            // 각 지역의 중심지 좌표 사용 (오프셋 없이 원본 좌표 사용)
            const centerLatitude = region.latitude; // 지역 중심지 위도
            const centerLongitude = region.longitude; // 지역 중심지 경도
            const newPos = new kakao.maps.LatLng(centerLatitude, centerLongitude);
            overlay.setPosition(newPos);
        }
    });
    
    console.log(`[updateRegionMarkerPositions] 레벨 ${currentLevel} - 지역 마커 위치 업데이트 완료`);
};

// 지역 마커 표시
window.displayRegionMarkers = function(regions) {
    const map = typeof window.getMap === 'function' ? window.getMap() : null;
    if (!map) return;
    
    // 기존 지역 마커 제거
    if (window.regionMarkers && window.regionMarkers.length > 0) {
        window.regionMarkers.forEach(overlay => {
            if (overlay) {
                overlay.setMap(null);
            }
        });
    }
    window.regionMarkers = [];
    window.regionData = [];
    
    if (typeof window.clearMarkers === 'function') {
        window.clearMarkers();
    }
    
    if (!regions || regions.length === 0) {
        console.log('지역 마커가 없습니다.');
        return;
    }
    
    console.log(`지역 마커 표시: ${regions.length}개`);
    
    regions.forEach(region => {
        // 지역 데이터 저장
        window.regionData.push(region);
        
        // 각 지역의 중심지 좌표 사용 (백엔드에서 제공하는 중심지 좌표)
        // 중심지에 정확히 배치 (오프셋 없이 원본 좌표 사용)
        const centerLatitude = region.latitude; // 지역 중심지 위도
        const centerLongitude = region.longitude; // 지역 중심지 경도
        const pos = new kakao.maps.LatLng(centerLatitude, centerLongitude);
        
        const regionDiv = document.createElement('div');
        regionDiv.style.cssText = `
            background: #fff;
            border-radius: 4px;
            border: 1px solid #2a6cd8;
            padding: 3px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 3px;
            cursor: pointer;
            white-space: nowrap;
        `;
        
        const countBox = document.createElement('div');
        countBox.style.cssText = `
            background: #d0e1fa;
            padding-left: 4px;
            padding-right: 4px;
            padding-top: 2px;
            padding-bottom: 2px;
            border-radius: 2px;
            font-size: 11px;
            font-weight: bold;
            color: #000;
            flex-shrink: 0;
        `;
        countBox.textContent = region.count;
        
        const nameText = document.createElement('span');
        nameText.style.cssText = `
            font-weight: bold;
            color: #000;
            font-size: 12px;
            flex-shrink: 0;
        `;
        nameText.textContent = region.regionName;
        
        regionDiv.appendChild(countBox);
        regionDiv.appendChild(nameText);
        
        const regionOverlay = new kakao.maps.CustomOverlay({
            position: pos,
            content: regionDiv,
            yAnchor: 0.5,
            xAnchor: 0.5
        });
        
        regionOverlay.setMap(map);
        
        // 지역 마커 클릭 이벤트
        regionDiv.addEventListener('click', () => {
            console.log(`[지역 마커 클릭] ${region.regionName} 클릭, 레벨 8로 설정`);
            const previousLevel = map.getLevel();
            // 각 지역의 중심지 좌표로 이동 (오프셋이 적용되지 않은 원본 좌표 사용)
            const regionCenter = new kakao.maps.LatLng(region.latitude, region.longitude);
            map.setLevel(8);
            map.panTo(regionCenter);
            
            if (window.previousMapLevel !== undefined) {
                window.previousMapLevel = previousLevel;
            }
            
            // 짧은 지연 후 업데이트
            setTimeout(() => {
                const currentLevel = map.getLevel();
                
                if (currentLevel >= 1 && currentLevel <= 3) {
                    if (typeof window.clearMarkers === 'function') {
                        window.clearMarkers();
                    }
                    if (typeof window.updateStations === 'function') {
                        window.updateStations({
                            useBounds: true,
                            forceCenterSearch: false,
                            forceIndividualMarkers: true
                        });
                    }
                    return;
                }
                
                const deltaArea = window.getDeltaArea();
                
                if (deltaArea === 'max') {
                    // 레벨 11 이상에서만 지역 마커 표시 (레벨 10까지는 표시 안 함)
                    if (currentLevel >= 11) {
                        if (typeof window.fetchRegionsFromAPI === 'function') {
                            window.fetchRegionsFromAPI().then(regions => {
                                if (regions.length > 0 && typeof window.displayRegionMarkers === 'function') {
                                    window.displayRegionMarkers(regions);
                                }
                            });
                        }
                    } else {
                        // 레벨 10 이하는 클러스터 표시
                        if (typeof window.fetchClustersFromAPI === 'function') {
                            try {
                                const clusters = window.fetchClustersFromAPI();
                                if (clusters && clusters.length > 0 && typeof window.displayClusterMarkers === 'function') {
                                    window.displayClusterMarkers(clusters);
                                }
                            } catch (error) {
                                console.error('클러스터 계산 오류:', error);
                            }
                        }
                    }
                } else if (deltaArea === 'large') {
                    if (typeof window.fetchClustersFromAPI === 'function') {
                        try {
                            const clusters = window.fetchClustersFromAPI(); // 동기적으로 즉시 계산!
                            if (clusters && clusters.length > 0 && typeof window.displayClusterMarkers === 'function') {
                                window.displayClusterMarkers(clusters);
                            }
                        } catch (error) {
                            console.error('클러스터 계산 오류:', error);
                        }
                    }
                } else {
                    if (typeof window.updateStations === 'function') {
                        window.updateStations({
                            useBounds: true,
                            forceCenterSearch: false,
                            forceIndividualMarkers: true
                        });
                    }
                }
            }, 100);
        });
        
        // markers 배열에 추가 (map.js의 markers 배열 사용)
        if (typeof window.addMarker === 'function') {
            window.addMarker(regionOverlay);
        } else {
            // fallback: 직접 markers 배열에 추가
            const markers = window.markers || [];
            markers.push(regionOverlay);
        }
        
        window.regionMarkers.push(regionOverlay);
    });
};

// 클러스터 마커 표시 (map.js의 MarkerClusterer 사용)
window.displayClusterMarkers = function(clusters) {
    const map = typeof window.getMap === 'function' ? window.getMap() : null;
    if (!map) return;
    
    const currentLevel = map.getLevel();
    // 모든 레벨에서 Delta Area 기반으로 클러스터 표시 가능 (동일한 기준 적용!)
    
    // map.js의 clearMarkers 함수 사용
    if (typeof window.clearMarkers === 'function') {
        window.clearMarkers();
    }
    
    if (!clusters || clusters.length === 0) {
        console.log('클러스터가 없습니다.');
        return;
    }
    
    console.log(`클러스터 마커 표시: ${clusters.length}개 (레벨: ${currentLevel})`);
    
    // 클러스터 DOM 생성 최적화: DocumentFragment 사용 및 배치 처리
    const clusterOverlays = [];
    const CLUSTER_STYLE = `
        width: 50px;
        height: 50px;
        background: #d9e5ffcb;
        color: #000;
        text-align: center;
        line-height: 50px;
        font-weight: 600;
        font-size: 12px;
        border-radius: 50%;
        border: 1px solid #3366FF;
        box-shadow: 0 2px 8px rgba(0,0,0,.2);
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // 클러스터 클릭 핸들러 (즉시 반응 - 지연 완전 제거)
    const createClusterClickHandler = (cluster) => {
        return () => {
            const currentLevel = map.getLevel();
            const newLevel = Math.max(1, currentLevel - 1);
            
            // 중복 업데이트 방지 플래그 설정
            window._clusterClickInProgress = true;
            
            const clusterPos = new kakao.maps.LatLng(cluster.latitude, cluster.longitude);
            
            // 지도 이동과 업데이트를 동시에 실행 (비동기)
            map.setLevel(newLevel);
            map.panTo(clusterPos);
            
            // 즉시 업데이트 (지연 없음)
            const finalLevel = newLevel; // 예상 레벨 사용
            
            if (finalLevel >= 4) {
                // 비동기로 처리하여 블로킹 방지
                Promise.resolve().then(() => {
                    if (typeof window.clearMarkers === 'function') {
                        window.clearMarkers();
                    }
                    if (typeof window.updateStations === 'function') {
                        window.updateStations({
                            useBounds: true,
                            forceCenterSearch: false,
                            forceIndividualMarkers: true
                        });
                    }
                    window._clusterClickInProgress = false;
                });
            } else {
                // 비동기로 처리하여 블로킹 방지
                Promise.resolve().then(() => {
                    if (typeof window.updateStations === 'function') {
                        window.updateStations({
                            useBounds: true,
                            forceCenterSearch: false,
                            forceIndividualMarkers: false
                        });
                    }
                    window._clusterClickInProgress = false;
                });
            }
        };
    };
    
    // 클러스터 생성 (최적화된 배치 처리)
    for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const pos = new kakao.maps.LatLng(cluster.latitude, cluster.longitude);
        
        const clusterDiv = document.createElement('div');
        clusterDiv.style.cssText = CLUSTER_STYLE;
        clusterDiv.textContent = cluster.count;
        
        // 클릭 이벤트 추가 (즉시)
        clusterDiv.addEventListener('click', createClusterClickHandler(cluster), { passive: true });
        
        const clusterOverlay = new kakao.maps.CustomOverlay({
            position: pos,
            content: clusterDiv,
            yAnchor: 0.5,
            xAnchor: 0.5
        });
        
        clusterOverlays.push(clusterOverlay);
    }
    
    // 지도에 일괄 추가 (비동기로 처리하여 블로킹 방지)
    Promise.resolve().then(() => {
        clusterOverlays.forEach(overlay => {
            overlay.setMap(map);
            if (typeof window.addMarker === 'function') {
                window.addMarker(overlay);
            } else if (typeof window.getMarkers === 'function') {
                const markers = window.getMarkers();
                if (markers && Array.isArray(markers)) {
                    markers.push(overlay);
                }
            }
        });
    });
};

// 개별 마커들을 MarkerClusterer로 클러스터링하는 함수 (map.js의 displayMarkersFallback에서 사용)
window.createMarkerClusterer = function(markers, currentLevel) {
    const map = typeof window.getMap === 'function' ? window.getMap() : null;
    if (!map || !markers || markers.length === 0) {
        return null;
    }
    
    // 레벨 5 이하에서는 클러스터를 사용하지 않음
    if (currentLevel <= 5) {
        console.log(`[createMarkerClusterer] 레벨 ${currentLevel} (5 이하) - 클러스터 사용 안 함`);
        return null;
    }
    
    // MarkerClusterer 사용 가능한지 확인
    if (typeof kakao === 'undefined' || typeof kakao.maps === 'undefined' || typeof kakao.maps.MarkerClusterer === 'undefined') {
        console.warn('MarkerClusterer를 사용할 수 없습니다.');
        return null;
    }
    
    // 기존 클러스터 제거
    if (clusterer) {
        clusterer.clear();
        clusterer = null;
    }
    
    // 클러스터 스타일 (2023-car-ffeine-develop 스타일)
    const clusterStyles = [
        {
            width: '40px',
            height: '40px',
            background: '#d9e5ffcb',
            color: '#000',
            textAlign: 'center',
            lineHeight: '40px',
            fontWeight: '600',
            fontSize: '11px',
            borderRadius: '50%',
            border: '1px solid #3366FF',
            boxShadow: '0 2px 8px rgba(0,0,0,.2)',
            padding: '0'
        },
        {
            width: '45px',
            height: '45px',
            background: '#d9e5ffcb',
            color: '#000',
            textAlign: 'center',
            lineHeight: '45px',
            fontWeight: '600',
            fontSize: '12px',
            borderRadius: '50%',
            border: '1px solid #3366FF',
            boxShadow: '0 2px 8px rgba(0,0,0,.2)',
            padding: '0'
        },
        {
            width: '50px',
            height: '50px',
            background: '#d9e5ffcb',
            color: '#000',
            textAlign: 'center',
            lineHeight: '50px',
            fontWeight: '600',
            fontSize: '13px',
            borderRadius: '50%',
            border: '1px solid #3366FF',
            boxShadow: '0 2px 8px rgba(0,0,0,.2)',
            padding: '0'
        }
    ];
    
    // 지도 레벨에 따라 gridSize 조정 (성능 최적화)
    let gridSize = 60;
    if (currentLevel >= 10) {
        gridSize = 120;
    } else if (currentLevel >= 8) {
        gridSize = 100;
    } else if (currentLevel >= 6) {
        gridSize = 80;
    } else {
        gridSize = 60;
    }
    
    try {
        // MarkerClusterer 생성 (성능 최적화 옵션)
        clusterer = new kakao.maps.MarkerClusterer({
            map: map,
            markers: markers,
            gridSize: gridSize,
            minClusterSize: 2,
            averageCenter: true,
            disableClickZoom: true, // 클러스터 클릭 시 자동 확대 비활성화 (직접 제어)
            calculator: [50, 100, 200],
            styles: clusterStyles
        });
        
        console.log(`[MarkerClusterer 생성 완료] ${markers.length}개 마커를 클러스터로 관리`);
        
        // 클러스터 클릭 이벤트 - 즉시 반영 (지연 완전 제거)
        kakao.maps.event.addListener(clusterer, 'clusterclick', (cluster) => {
            const currentLevel = map.getLevel();
            const clusterCenter = cluster.getCenter();
            const newLevel = Math.max(1, currentLevel - 1);
            
            // 중복 업데이트 방지 플래그 설정
            window._clusterClickInProgress = true;
            
            // 레벨 변경 및 중심 이동 (즉시 실행)
            map.setLevel(newLevel);
            map.panTo(clusterCenter);
            
            // 즉시 업데이트 (비동기로 처리하여 블로킹 방지)
            Promise.resolve().then(() => {
                const finalLevel = newLevel; // 예상 레벨 사용
                
                if (finalLevel >= 4) {
                    if (typeof window.clearClusterer === 'function') {
                        window.clearClusterer();
                    }
                    if (typeof window.updateStations === 'function') {
                        window.updateStations({
                            useBounds: true,
                            forceCenterSearch: false,
                            forceIndividualMarkers: true
                        });
                    }
                } else {
                    if (typeof window.updateStations === 'function') {
                        window.updateStations({
                            useBounds: true,
                            forceCenterSearch: false,
                            forceIndividualMarkers: false
                        });
                    }
                }
                
                // 플래그 해제
                window._clusterClickInProgress = false;
            });
        });
        
        return clusterer;
    } catch (error) {
        console.error('MarkerClusterer 생성 실패:', error);
        clusterer = null;
        return null;
    }
};

// clusterer 가져오기
window.getClustererFromCluster = function() {
    return clusterer;
};

// clusterer 제거
window.clearClusterer = function() {
    if (clusterer) {
        clusterer.clear();
        clusterer = null;
    }
};

// 클러스터 오버레이 제거 함수 (호환성)
window.clearClusterOverlays = function() {
    // clusterOverlays는 displayClusterMarkers 내부에서 관리되므로
    // clearMarkers가 호출되면 자동으로 제거됨
};

// 지역 마커 오버레이 제거 함수 (호환성)
window.clearRegionMarkers = function() {
    if (window.regionMarkers && window.regionMarkers.length > 0) {
        window.regionMarkers.forEach(overlay => {
            if (overlay && overlay.setMap) {
                overlay.setMap(null);
            }
        });
        window.regionMarkers = [];
    }
    window.regionData = [];
};
