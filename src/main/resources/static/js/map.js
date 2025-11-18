// 지도 초기화 및 마커 관리

let map = null;
let markers = [];
let userLocation = null;
let selectedMarker = null; // 현재 선택된 마커
let markerStationMap = new Map(); // 마커와 충전소 정보 매핑

// 전역 변수 (이벤트 리스너에서 사용)
window._ignoreIdle = false;
window._idleUpdateInProgress = false;
window._clusterClickInProgress = false;
window._ignoreZoomClose = false; // 마커 클릭 후 zoom_changed에서 오버레이 닫기 무시
window.overlayOpenedAt = 0; // 오버레이가 열린 시간 (안정화 시간 계산용) - 전역 변수
window._sidebarSelection = false; // 사이드바에서 충전소 선택 중인지 여부
window._blockZoomForce = false; // 사이드바 클릭 시 zoom_changed의 forceCloseByLevel 비활성화 플래그
window._blockMapUpdate = false; // 사이드바 클릭 시 확대하는 동안 updateStationsOnMapChange 일시 정지 플래그
window._lockZoomChange = false; // 사이드바 클릭 시 zoom_changed 이벤트 무시 플래그
let lastIdleTime = 0;
const IDLE_THROTTLE_MS = 150;
const OVERLAY_STABILIZE_MS = 600; // 오버레이 안정화 시간 (600ms)

// 지도 객체 가져오기
function getMap() {
    return map;
}

// 전역 함수로 노출 (cluster.js에서 사용)
window.getMap = getMap;

// 지도 초기화
function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('지도 컨테이너를 찾을 수 없습니다.');
        return;
    }

    // 지도 컨테이너 크기 명시적 설정
    mapContainer.style.width = '100vw';
    mapContainer.style.height = '100vh';
    mapContainer.style.position = 'absolute';
    mapContainer.style.top = '0';
    mapContainer.style.left = '0';

    // 지도 초기화 함수
    const createMap = (center) => {
        try {
            map = new kakao.maps.Map(mapContainer, {
                center: center,
                level: 5,
                scrollwheel: true,
                disableDoubleClick: false,
                disableDoubleClickZoom: false
            });
            
            console.log('지도 초기화 완료:', map);
            
            // 지도 레이아웃 재계산 (여러 번 시도)
            const relayoutMap = () => {
                if (map) {
                    map.relayout();
                    kakao.maps.event.trigger(map, 'resize');
                }
            };
            
            // 즉시 실행
            relayoutMap();
            
            // 짧은 지연 후 실행
            setTimeout(relayoutMap, 50);
            setTimeout(relayoutMap, 100);
            setTimeout(relayoutMap, 300);
            setTimeout(relayoutMap, 500);
            
            // 커스텀 컨트롤 버튼 추가
            setupCustomControls();
        } catch (error) {
            console.error('지도 초기화 오류:', error);
        }
    };

    // 네이버 지도처럼: 사용자 위치를 기준으로 초기화
    // 먼저 사용자 위치를 가져오고, 없으면 기본값 사용
    if (navigator.geolocation) {
        const geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };
        navigator.geolocation.getCurrentPosition(pos => {
            userLocation = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            };
            const currentPos = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
            createMap(currentPos);
        }, err => {
            console.warn("위치 정보 접근 실패:", err);
            // 위치 정보가 없으면 기본 중심으로 초기화
            const defaultPos = new kakao.maps.LatLng(37.5665, 126.9780); // 서울
            createMap(defaultPos);
        }, geoOptions);
    } else {
        // Geolocation을 지원하지 않으면 기본 중심으로 초기화
        const defaultPos = new kakao.maps.LatLng(37.5665, 126.9780); // 서울
        createMap(defaultPos);
    }

    return map;
}

// 전역 함수로 노출 (main.js에서 사용)
window.initMap = initMap;

// 커스텀 컨트롤 버튼 설정 (줌 인/아웃, 현재 위치)
function setupCustomControls() {
    if (!map) return;

    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    // 기존 컨트롤 제거
    const existingZoomIn = document.getElementById('custom-zoom-in');
    const existingZoomOut = document.getElementById('custom-zoom-out');
    const existingLocation = document.getElementById('current-location-btn');
    if (existingZoomIn) existingZoomIn.remove();
    if (existingZoomOut) existingZoomOut.remove();
    if (existingLocation) existingLocation.remove();

    // 컨트롤 컨테이너 생성 (오른쪽 하단 - 반응형)
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'custom-map-controls';

    // 반응형 위치 업데이트 함수 (개발자 도구가 열려도 사라지지 않도록)
    const updateControlsPosition = () => {
        const mapRect = mapContainer.getBoundingClientRect();
        const rightOffset = window.innerWidth - mapRect.right + 20; // 지도 오른쪽 끝에서 20px

        // 최소/최대 위치 보장 (화면 밖으로 나가지 않도록)
        const minRight = 20;
        const maxRight = window.innerWidth - 60; // 버튼 너비(40px) + 여유공간(20px)
        const finalRight = Math.max(minRight, Math.min(maxRight, rightOffset));

        // 작은 화면(800px 이하)에서는 bottom을 더 위로, 큰 화면에서는 원래 위치로
        const isSmallScreen = window.innerWidth <= 800;
        const bottomPosition = isSmallScreen ? 80 : 25;

        // 지도가 화면 밖으로 나가면 숨기지 않고 최소 위치에 배치
        controlsContainer.style.cssText = `
      position: fixed;
      right: ${finalRight}px;
      bottom: ${bottomPosition}px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 2147483647 !important;
      pointer-events: auto;
      visibility: visible;
      opacity: 1;
    `;

        // 검색 결과 없음 오버레이 위치 조정
        adjustNoResultOverlay();

        // 하단 요소들 위치 조정 (겹치지 않도록)
        updateBottomElementsPosition();
    };

    // 검색 결과 없음 오버레이 위치 조정 함수
    const adjustNoResultOverlay = () => {
        // Kakao Maps의 검색 결과 없음 오버레이 찾기
        const mapDiv = document.getElementById('map');
        if (!mapDiv) return;

        // 지도 내부의 모든 div 요소 확인
        const allDivs = mapDiv.querySelectorAll('div');
        allDivs.forEach(div => {
            const text = div.textContent || '';
            // "검색 결과가 없습니다" 또는 "검색 결과 없음" 등의 텍스트가 있는 요소 찾기
            if (text.includes('검색 결과') && (text.includes('없습니다') || text.includes('없음'))) {
                // z-index를 낮추고 위치 조정
                const rect = div.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const controlsRect = controlsContainer.getBoundingClientRect();

                // 컨트롤 버튼과 겹치지 않도록 오버레이 너비 제한
                const maxWidth = Math.min(rect.width, viewportWidth - controlsRect.width - 40);

                div.style.zIndex = '100';
                div.style.maxWidth = `${maxWidth}px`;
                div.style.marginRight = `${controlsRect.width + 20}px`;

                // 작은 화면에서는 위치 조정
                if (viewportWidth < 600) {
                    div.style.left = '50%';
                    div.style.transform = 'translateX(-50%)';
                    div.style.maxWidth = 'calc(100vw - 100px)';
                }
            }
        });
    };

    // 하단 요소들 위치 조정 함수
    const updateBottomElementsPosition = () => {
        const searchBtn = document.getElementById('searchBtn');
        const markerLegend = document.getElementById('marker-legend');
        const viewportWidth = window.innerWidth;

        if (searchBtn) {
            // 검색 버튼 중앙 정렬 유지
            searchBtn.style.left = '50%';
            searchBtn.style.transform = 'translateX(-50%)';
        }

        if (markerLegend) {
            // 마커 범례 위치 조정
            const searchBtnRect = searchBtn ? searchBtn.getBoundingClientRect() : null;
            const searchBtnRight = searchBtnRect ? searchBtnRect.right : viewportWidth / 2;

            // 검색 버튼 오른쪽에 배치하되, 화면 밖으로 나가지 않도록
            let legendLeft = searchBtnRight + 20;
            const legendWidth = markerLegend.offsetWidth || 200;

            if (legendLeft + legendWidth > viewportWidth - 20) {
                // 오른쪽에 공간이 없으면 검색 버튼 위에 배치
                legendLeft = viewportWidth / 2;
                markerLegend.style.bottom = '80px'; // 검색 버튼 위
                markerLegend.style.left = '50%';
                markerLegend.style.transform = 'translateX(-50%)';
            } else {
                // 오른쪽에 공간이 있으면 기존 위치 유지
                markerLegend.style.bottom = '25px';
                markerLegend.style.left = `${legendLeft}px`;
                markerLegend.style.transform = 'none';
            }

            // 컨트롤 버튼과 겹치지 않도록
            const controlsRect = controlsContainer.getBoundingClientRect();
            if (legendLeft + legendWidth > controlsRect.left - 10) {
                markerLegend.style.bottom = '80px';
                markerLegend.style.left = '50%';
                markerLegend.style.transform = 'translateX(-50%)';
            }
        }
    };

    // 초기 위치 설정
    updateControlsPosition();

    // 리사이즈 시 위치 업데이트 (개발자 도구 포함)
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            updateControlsPosition();
        }, 50);
    });

    // MutationObserver로 동적으로 생성되는 검색 결과 없음 오버레이 감지
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
        const observer = new MutationObserver(() => {
            adjustNoResultOverlay();
        });

        observer.observe(mapDiv, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // 주기적으로도 확인 (오버레이가 늦게 생성될 수 있음)
        setInterval(() => {
            adjustNoResultOverlay();
        }, 500);
    }

    // 줌 인 버튼
    const zoomInBtn = document.createElement('button');
    zoomInBtn.id = 'custom-zoom-in';
    zoomInBtn.innerHTML = '+';
    zoomInBtn.title = '확대';
    zoomInBtn.style.cssText = `
    width: 40px;
    height: 40px;
    background: white;
    border: none;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    cursor: pointer;
    font-size: 24px;
    font-weight: bold;
    color: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  `;
    zoomInBtn.onmouseover = () => {
        zoomInBtn.style.background = '#f5f5f5';
        zoomInBtn.style.transform = 'scale(1.05)';
    };
    zoomInBtn.onmouseout = () => {
        zoomInBtn.style.background = 'white';
        zoomInBtn.style.transform = 'scale(1)';
    };
    zoomInBtn.onclick = () => {
        const currentLevel = map.getLevel();
        if (currentLevel > 1) {
            map.setLevel(currentLevel - 1);
            // 이전 레벨 업데이트
            if (window.previousMapLevel !== undefined) {
                window.previousMapLevel = currentLevel - 1;
            }
            // 즉시 업데이트
            if (typeof window.updateStationsOnMapChange === 'function') {
                window.updateStationsOnMapChange();
            }
        }
    };

    // 줌 아웃 버튼
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.id = 'custom-zoom-out';
    zoomOutBtn.innerHTML = '−';
    zoomOutBtn.title = '축소';
    zoomOutBtn.style.cssText = `
    width: 40px;
    height: 40px;
    background: white;
    border: none;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    cursor: pointer;
    font-size: 24px;
    font-weight: bold;
    color: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  `;
    zoomOutBtn.onmouseover = () => {
        zoomOutBtn.style.background = '#f5f5f5';
        zoomOutBtn.style.transform = 'scale(1.05)';
    };
    zoomOutBtn.onmouseout = () => {
        zoomOutBtn.style.background = 'white';
        zoomOutBtn.style.transform = 'scale(1)';
    };
    zoomOutBtn.onclick = () => {
        const currentLevel = map.getLevel();
        if (currentLevel < 14) {
            map.setLevel(currentLevel + 1);
            // 이전 레벨 업데이트
            if (window.previousMapLevel !== undefined) {
                window.previousMapLevel = currentLevel + 1;
            }
            // 즉시 업데이트
            if (typeof window.updateStationsOnMapChange === 'function') {
                window.updateStationsOnMapChange();
            }
        }
    };

    // 마우스 휠 줌 - 무조건 즉각 반응 (debounce 완전 제거!)
    let lastLevel = map.getLevel();

    mapContainer.addEventListener('wheel', (e) => {
        // 마우스 휠 이벤트 감지
        const currentLevel = map.getLevel();

        // 레벨이 변경되었는지 확인
        if (currentLevel !== lastLevel) {
            lastLevel = currentLevel;

            // 무조건 즉시 업데이트 (무한히 빠르게!)
            console.log(`[마우스 휠 줌] 즉각 반응, 레벨: ${currentLevel}에서 즉시 업데이트`);

            // 확대/축소 시 오버레이 닫기 (레벨 기반 강제 닫기)
            if (typeof window.forceCloseByLevel === 'function') {
                window.forceCloseByLevel();
            } else if (window.currentOverlay) {
                window.currentOverlay.setMap(null);
                window.currentOverlay = null;
            }

            if (typeof window.updateStationsOnMapChange === 'function') {
                window.updateStationsOnMapChange();
            } else if (typeof updateStationsOnMapChange === 'function') {
                updateStationsOnMapChange();
            }
        }
    }, { passive: true });

    // 현재 위치 버튼 (맨 위)
    const locationBtn = document.createElement('button');
    locationBtn.id = 'current-location-btn';
    locationBtn.innerHTML = '📍';
    locationBtn.title = '내 위치로 이동';
    locationBtn.style.cssText = `
    width: 40px;
    height: 40px;
    background: white;
    border: none;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    margin-bottom: 12px;
  `;
    locationBtn.onmouseover = () => {
        locationBtn.style.background = '#f5f5f5';
        locationBtn.style.transform = 'scale(1.05)';
    };
    locationBtn.onmouseout = () => {
        locationBtn.style.background = 'white';
        locationBtn.style.transform = 'scale(1)';
    };
    locationBtn.onclick = () => {
        if (!userLocation) {
            // 위치 정보가 없으면 다시 가져오기
            if (navigator.geolocation) {
                const geoOptions = {
                    enableHighAccuracy: true,  // 더 정확한 위치 정보 요청 (GPS 사용)
                    timeout: 10000,  // 10초 타임아웃
                    maximumAge: 0  // 캐시된 위치 정보 사용 안 함 (항상 최신 위치)
                };
                navigator.geolocation.getCurrentPosition(pos => {
                    userLocation = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    };
                    const currentPos = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
                    map.setCenter(currentPos);
                    map.setLevel(2); // 레벨 2로 설정
                }, err => {
                    alert('위치 정보를 가져올 수 없습니다.');
                    console.warn("위치 정보 접근 실패:", err);
                }, geoOptions);
            }
        } else {
            // 위치 정보가 있으면 바로 이동
            const currentPos = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
            map.setCenter(currentPos);
            map.setLevel(2); // 레벨 2로 설정
        }
    };

    // 버튼들을 컨테이너에 추가 (위치 버튼이 맨 위, 그 다음 +, -)
    controlsContainer.appendChild(locationBtn);
    controlsContainer.appendChild(zoomInBtn);
    controlsContainer.appendChild(zoomOutBtn);

    // 지도 컨테이너에 컨테이너 추가
    mapContainer.appendChild(controlsContainer);
}

// 마커 제거 (전역 함수로 노출 - cluster.js에서 사용)
window.clearMarkers = function() {
    markers.forEach(m => {
        if (m && m.setMap) {
            m.setMap(null);
        }
    });
    markers = [];
    selectedMarker = null;
    markerStationMap.clear();

    // cluster.js의 clusterer 제거
    if (typeof window.clearClusterer === 'function') {
        window.clearClusterer();
    }

    // 클러스터 오버레이 제거 (CustomOverlay)
    // markers 배열에 저장된 오버레이들도 제거됨
    // 추가로 전역 배열이 있다면 제거
    if (window.clusterOverlays && Array.isArray(window.clusterOverlays)) {
        window.clusterOverlays.forEach(overlay => {
            if (overlay && overlay.setMap) {
                overlay.setMap(null);
            }
        });
        window.clusterOverlays = [];
    }

    // 지역 마커 오버레이 제거
    if (window.regionOverlays && Array.isArray(window.regionOverlays)) {
        window.regionOverlays.forEach(overlay => {
            if (overlay && overlay.setMap) {
                overlay.setMap(null);
            }
        });
        window.regionOverlays = [];
    }
}

// 마커 강조 (크게 만들기)
function highlightMarker(marker, station) {
    // 이전에 선택된 마커가 있으면 원래 크기로 복원
    if (selectedMarker && selectedMarker !== marker) {
        const prevStation = markerStationMap.get(selectedMarker);
        if (prevStation) {
            let prevColor = "gray";
            if (prevStation.realtime && Array.isArray(prevStation.realtime)) {
                let available = 0, charging = 0, checking = 0;
                
                // 전역 예약 정보 가져오기
                const activeReservations = window.activeReservations || [];
                
                prevStation.realtime.forEach((r, index) => {
                    const status = r.status || "정보없음";
                    const chargerId = r.chgerId || index.toString();
                    
                    // 예약 시간대가 활성화된 경우 확인 (충전기 ID 일치만 체크)
                    const isActiveReservation = activeReservations.some(ar =>
                        ar.chargerId && String(ar.chargerId) === String(chargerId)
                    );
                    
                    // 예약 시간대가 활성화된 경우 충전중으로 처리
                    if (isActiveReservation && (status.includes("충전가능") || status.includes("정보없음"))) {
                        charging++;
                    }
                    else if (status.includes("충전가능") || status.includes("정보없음")) {
                        available++;
                    }
                    else if (status.includes("충전중")) {
                        charging++;
                    }
                    else if (status.includes("점검중")) {
                        checking++;
                    }
                });
                if (available > 0) prevColor = "green";
                else if (charging > 0) prevColor = "red";
                else if (checking > 0) prevColor = "orange";
            }
            selectedMarker.setImage(createMarkerImage(prevColor));
            // zIndex도 원래대로 복원
            selectedMarker.setZIndex(1);

            // 이전 마커 주변의 마커들도 z-index 복원
            if (prevStation.lat && prevStation.lng && map) {
                markers.forEach(m => {
                    if (m !== selectedMarker && m.getMap()) {
                        const mStation = markerStationMap.get(m) || m.station;
                        if (mStation && mStation.lat && mStation.lng) {
                            const distance = Math.sqrt(
                                Math.pow(prevStation.lat - mStation.lat, 2) +
                                Math.pow(prevStation.lng - mStation.lng, 2)
                            );
                            if (distance < 0.0005) {
                                m.setZIndex(1); // 원래대로 복원
                            }
                        }
                    }
                });
            }
        }
    }

    // 새로 선택된 마커를 크게 만들기
    selectedMarker = marker;

    // 마커 색상 결정 - 예약 정보 고려
    let color = "gray";
    if (station.realtime && Array.isArray(station.realtime)) {
        let available = 0, charging = 0, checking = 0;
        
        // 전역 예약 정보 가져오기
        const activeReservations = window.activeReservations || [];
        
        station.realtime.forEach((r, index) => {
            const status = r.status || "정보없음";
            const chargerId = r.chgerId || index.toString();
            
            // 예약 시간대가 활성화된 경우 확인 (충전기 ID 일치만 체크)
            const isActiveReservation = activeReservations.some(ar =>
                ar.chargerId && String(ar.chargerId) === String(chargerId)
            );
            
            // 예약 시간대가 활성화된 경우 충전중으로 처리
            if (isActiveReservation && (status.includes("충전가능") || status.includes("정보없음"))) {
                charging++;
            }
            else if (status.includes("충전가능") || status.includes("정보없음")) {
                available++;
            }
            else if (status.includes("충전중")) {
                charging++;
            }
            else if (status.includes("점검중")) {
                checking++;
            }
        });
        if (available > 0) color = "green";
        else if (charging > 0) color = "red";
        else if (checking > 0) color = "orange";
    }

    // 큰 마커 이미지 생성 (48x48 - 다른 마커를 가리지 않도록 적당한 크기)
    const src = color === 'green' ? getImagePath('g.png')
        : color === 'red' ? getImagePath('r.png')
            : getImagePath('o.png');
    const largeSize = new kakao.maps.Size(48, 48);
    const largeOptions = {
        offset: new kakao.maps.Point(24, 48) // 중심점 조정
    };
    const largeImage = new kakao.maps.MarkerImage(src, largeSize, largeOptions);

    marker.setImage(largeImage);

    // 마커의 zIndex를 높여서 다른 요소들 위에 표시 (하지만 주변 마커도 클릭 가능하도록)
    marker.setZIndex(1000);

    // 주변 마커들의 z-index를 높여서 클릭 가능하게 만들기
    const markerPos = marker.getPosition();
    if (markerPos && map) {
        const stationPos = { lat: station.lat, lng: station.lng };
        markers.forEach(m => {
            if (m !== marker && m.getMap()) {
                const mStation = markerStationMap.get(m) || m.station;
                if (mStation && mStation.lat && mStation.lng) {
                    // 선택된 마커와 가까운 마커들 (약 50m 이내)
                    const distance = Math.sqrt(
                        Math.pow(stationPos.lat - mStation.lat, 2) +
                        Math.pow(stationPos.lng - mStation.lng, 2)
                    );
                    // 가까운 마커들의 z-index를 높여서 클릭 가능하게
                    if (distance < 0.0005) { // 약 50m
                        m.setZIndex(500); // 선택된 마커보다는 낮지만 일반 마커보다는 높게
                    } else {
                        // 멀리 있는 마커는 원래 z-index로 복원
                        m.setZIndex(1);
                    }
                }
            }
        });
    }

    console.log('마커 강조됨:', station.name);
}

// 충전소 정보로 마커 찾기 및 강조
function highlightMarkerByStation(station) {
    if (!station || !station.lat || !station.lng) return;

    // 해당 충전소의 마커 찾기 (ID 기반 비교로 변경)
    const targetMarker = markers.find(m => {
        const mStation = markerStationMap.get(m) || m.station;
        if (!mStation) return false;
        // ID 기반 비교 (statId 또는 id 사용)
        return (mStation.id && station.id && mStation.id === station.id) ||
               (mStation.statId && station.statId && mStation.statId === station.statId) ||
               // ID가 없으면 위치 기반 비교 (fallback)
               (Math.abs(mStation.lat - station.lat) < 0.0001 &&
                Math.abs(mStation.lng - station.lng) < 0.0001);
    });

    if (targetMarker) {
        const targetStation = markerStationMap.get(targetMarker) || targetMarker.station || station;
        highlightMarker(targetMarker, targetStation);
    } else {
        console.log('해당 충전소의 마커를 찾을 수 없습니다:', station.name, station.id || station.statId);
    }
}

// 클러스터 관련 함수는 cluster.js로 이동됨

// 마커 생성 및 표시 (2023-car-ffeine-develop 방식)
// 주의: 실제 마커 표시는 idle 이벤트에서 처리됨
// 이 함수는 stations를 저장만 하고, idle 이벤트에서 Delta Area에 따라 클러스터/마커 결정
function displayMarkers(stations, opts = {}) {
    // 현재 충전소 목록 저장 (idle 이벤트에서 사용)
    window.currentStations = stations;

    if (!map || !stations || stations.length === 0) {
        console.log('마커 표시할 충전소가 없습니다.');
        clearMarkers();
        return;
    }

    console.log(`표시할 충전소 개수: ${stations.length}`);

    // forceIndividualMarkers 플래그가 있으면 무조건 개별 마커 표시
    if (opts.forceIndividualMarkers) {
        console.log(`[displayMarkers] forceIndividualMarkers 플래그로 개별 마커 강제 표시`);
        displayMarkersFallback(stations);
        return;
    }

    // 레벨 확인
    const currentLevel = map ? map.getLevel() : 10;

    // 레벨 5 이하 → 개별 마커 표시
    if (currentLevel <= 5) {
        console.log(`[displayMarkers] 레벨 ${currentLevel} (5 이하) → 개별 마커 표시`);
        displayMarkersFallback(stations);
        return;
    }

    // 레벨 6~10 → 클러스터 표시
    if (currentLevel >= 6 && currentLevel <= 10) {
        console.log(`[displayMarkers] 레벨 ${currentLevel} (6~10) - 클러스터 표시`);
        if (typeof window.fetchClustersFromAPI === 'function') {
            try {
                const clusters = window.fetchClustersFromAPI();
                if (clusters && clusters.length > 0 && typeof window.displayClusterMarkers === 'function') {
                    window.displayClusterMarkers(clusters);
                } else {
                    displayMarkersFallback(stations);
                }
            } catch (error) {
                console.error('[displayMarkers] 클러스터 계산 오류:', error);
                displayMarkersFallback(stations);
            }
        } else {
            displayMarkersFallback(stations);
        }
        return;
    }

    // 레벨 11 이상에서만 Delta Area 기반으로 처리
    const deltaArea = typeof window.getDeltaArea === 'function' ? window.getDeltaArea() : 'medium';
    const scaleDistance = typeof window.getMapScaleDistance === 'function' ? window.getMapScaleDistance() : Infinity;
    console.log(`[displayMarkers] Delta Area: ${deltaArea}, 레벨: ${currentLevel}, 스케일: ${scaleDistance.toFixed(0)}m`);

    if (deltaArea === 'max') {
        // 레벨 11 이상: 지역 마커 표시
        console.log(`[displayMarkers] 레벨 ${currentLevel} (11 이상) - 지역 마커 표시`);
        if (typeof window.fetchRegionsFromAPI === 'function') {
            window.fetchRegionsFromAPI().then(regions => {
                if (regions.length > 0 && typeof window.displayRegionMarkers === 'function') {
                    window.displayRegionMarkers(regions);
                }
            });
        }
    } else if (deltaArea === 'large') {
        // Large Delta Area: 클러스터만 표시 (개별 마커는 표시하지 않음)
        if (typeof window.fetchClustersFromAPI === 'function') {
            try {
                const clusters = window.fetchClustersFromAPI(); // 동기적으로 즉시 계산!
                if (clusters && clusters.length > 0 && typeof window.displayClusterMarkers === 'function') {
                    window.displayClusterMarkers(clusters);
                } else {
                    // 클러스터가 없으면 개별 마커 표시 (fallback)
                    console.log('[displayMarkers] 클러스터가 없어서 개별 마커 표시');
                    displayMarkersFallback(stations);
                }
            } catch (error) {
                console.error('[displayMarkers] 클러스터 계산 오류:', error);
                displayMarkersFallback(stations);
            }
        } else {
            displayMarkersFallback(stations);
        }
    } else {
        // Medium/Small Delta Area: 모든 레벨에서 클라이언트 사이드 클러스터 사용
        if (typeof window.fetchClustersFromAPI === 'function') {
            try {
                const clusters = window.fetchClustersFromAPI(); // 동기적으로 즉시 계산!
                console.log(`[displayMarkers] 레벨 ${currentLevel} - 클러스터 계산 결과: ${clusters ? clusters.length : 0}개`);
                if (clusters && clusters.length > 0 && typeof window.displayClusterMarkers === 'function') {
                    console.log(`[displayMarkers] 레벨 ${currentLevel} - 클러스터 ${clusters.length}개 표시`);
                    window.displayClusterMarkers(clusters);
                } else {
                    // 클러스터가 없으면 MarkerClusterer 사용
                    console.log(`[displayMarkers] 레벨 ${currentLevel} - 클러스터 없음, MarkerClusterer 사용`);
                    displayMarkersFallback(stations);
                }
            } catch (error) {
                console.error(`[displayMarkers] 레벨 ${currentLevel} - 클러스터 계산 오류:`, error);
                displayMarkersFallback(stations);
            }
        } else {
            displayMarkersFallback(stations);
        }
    }
}

// 기존 마커 표시 방식 (fallback)
function displayMarkersFallback(stations) {
    if (!map || !stations || stations.length === 0) {
        console.log('[displayMarkersFallback] 마커 표시할 충전소가 없습니다.');
        return;
    }

    console.log(`[displayMarkersFallback] 시작: ${stations.length}개 충전소`);

    // 기존 마커 제거
    clearMarkers();

    // 지도 스케일 거리 확인
    const scaleDistance = typeof window.getMapScaleDistance === 'function' ? window.getMapScaleDistance() : Infinity;
    const currentLevel = map.getLevel();
    console.log(`[displayMarkersFallback] 레벨: ${currentLevel}, 스케일: ${scaleDistance.toFixed(0)}m`);

    // 성능 최적화: 스케일 거리에 따라 마커 생성 제한
    let visibleStations = stations;

    // 스케일이 100m 이하일 때는 모든 마커 표시 (제한 없음)
    if (scaleDistance <= 100) {
        console.log(`[displayMarkersFallback] 스케일 ${scaleDistance.toFixed(0)}m <= 100m, 모든 마커 표시`);
        visibleStations = stations;
    } else if (currentLevel === 1) {
        // 레벨 1: 최대 500개만 샘플링
        const sampleSize = Math.min(500, stations.length);
        const step = Math.max(1, Math.floor(stations.length / sampleSize));
        visibleStations = [];
        for (let i = 0; i < stations.length; i += step) {
            if (visibleStations.length >= sampleSize) break;
            visibleStations.push(stations[i]);
        }
        console.log(`성능 최적화: 광역시 단위 - ${stations.length}개 중 ${visibleStations.length}개 샘플링`);
    } else if (currentLevel <= 8) {
        // 시·군·구 단위: 최대 800개만 샘플링
        const sampleSize = Math.min(800, stations.length);
        const step = Math.max(1, Math.floor(stations.length / sampleSize));
        visibleStations = [];
        for (let i = 0; i < stations.length; i += step) {
            if (visibleStations.length >= sampleSize) break;
            visibleStations.push(stations[i]);
        }
        console.log(`성능 최적화: 시·군·구 단위 - ${stations.length}개 중 ${visibleStations.length}개 샘플링`);
    } else if (currentLevel <= 10) {
        // 동 단위: 최대 1200개만 샘플링
        if (stations.length > 1200) {
            const step = Math.floor(stations.length / 1200);
            visibleStations = [];
            for (let i = 0; i < stations.length; i += step) {
                if (visibleStations.length >= 1200) break;
                visibleStations.push(stations[i]);
            }
            console.log(`성능 최적화: 동 단위 - ${stations.length}개 중 ${visibleStations.length}개 샘플링`);
        }
    } else if (stations.length > 1500) {
        // 레벨 11 이상에서 개별 마커 표시 시 1500개로 제한
        console.log(`성능 최적화: ${stations.length}개 중 1500개만 표시합니다.`);
        visibleStations = stations.slice(0, 1500);
    }

    // 예약 정보 로드 (비동기)
    fetch('/api/reservations/my')
        .then(res => {
            if (res.status === 401) {
                // 인증 실패 시 빈 배열 반환 (조용히 처리)
                return [];
            }
            return res.ok ? res.json() : [];
        })
        .catch(() => {
            // 네트워크 오류 등은 조용히 처리
            return [];
        })
        .then(reservations => {
            const now = new Date();
            const activeReservations = [];
            
            if (reservations && Array.isArray(reservations)) {
                reservations.forEach(reservation => {
                    if (reservation.reserveDate && reservation.reserveTime) {
                        try {
                            let timeStr = reservation.reserveTime;
                            if (timeStr && timeStr.length === 5 && timeStr.match(/^\d{2}:\d{2}$/)) {
                                timeStr = timeStr + ':00';
                            }
                            
                            const [year, month, day] = reservation.reserveDate.split('-').map(Number);
                            const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
                            
                            const reserveDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
                            const reserveEndTime = new Date(reserveDateTime);
                            reserveEndTime.setHours(reserveEndTime.getHours() + 1);
                            
                            if (now >= reserveDateTime && now < reserveEndTime) {
                                activeReservations.push({
                                    chargerId: reservation.chgerId || reservation.chargerId,
                                    placeName: reservation.placeName,
                                    reserveDateTime: reserveDateTime,
                                    reserveEndTime: reserveEndTime
                                });
                            }
                        } catch (e) {
                            console.warn('예약 시간 파싱 오류:', e);
                        }
                    }
                });
            }
            
            // 전역 예약 정보 저장
            window.activeReservations = activeReservations;
            
            // 마커 생성 시작
            createMarkersWithReservations(activeReservations, visibleStations, currentLevel);
        })
        .catch(err => {
            console.error('예약 목록 로드 오류:', err);
            // 예약 정보 없이 마커 생성
            window.activeReservations = [];
            createMarkersWithReservations([], visibleStations, currentLevel);
        });
    
    // 마커 생성 함수 (예약 정보 포함)
    function createMarkersWithReservations(activeReservations, visibleStations, currentLevel) {
        // 마커 생성 배치 처리 (성능 최적화)
        const BATCH_SIZE = 50; // 한 번에 처리할 마커 개수
        let markerIndex = 0;
        const markersToAdd = [];

        // 색상 결정 함수 (최적화) - 예약 정보 고려
        const getMarkerColor = (st) => {
            if (!st.realtime || !Array.isArray(st.realtime)) return "gray";
            let available = 0, charging = 0, checking = 0;
            
            for (let i = 0; i < st.realtime.length; i++) {
                const r = st.realtime[i];
                const status = r.status || "정보없음";
                const chargerId = r.chgerId || i.toString();
                
                // 예약 시간대가 활성화된 경우 확인 (충전기 ID 일치만 체크)
                const isActiveReservation = activeReservations.some(ar =>
                    ar.chargerId && String(ar.chargerId) === String(chargerId)
                );
                
                // 예약 시간대가 활성화된 경우 충전중으로 처리
                if (isActiveReservation && (status.includes("충전가능") || status.includes("정보없음"))) {
                    charging++;
                }
                else if (status.includes("충전가능") || status.includes("정보없음")) {
                    available++;
                }
                else if (status.includes("충전중")) {
                    charging++;
                }
                else if (status.includes("점검중")) {
                    checking++;
                }
            }
            if (available > 0) return "green";
            if (charging > 0) return "red";
            if (checking > 0) return "orange";
            return "gray";
        };

        // 배치 처리 함수
        const processBatch = () => {
        const endIndex = Math.min(markerIndex + BATCH_SIZE, visibleStations.length);

        for (let i = markerIndex; i < endIndex; i++) {
            const st = visibleStations[i];
            const color = getMarkerColor(st);
            const pos = new kakao.maps.LatLng(st.lat, st.lng);

            // 마커 생성 (지도에 추가하지 않음 - 나중에 일괄 추가)
            const marker = new kakao.maps.Marker({
                position: pos,
                image: createMarkerImage(color), // 캐싱된 이미지 사용
                map: null, // 나중에 추가
                zIndex: 1
            });

            // 🔥 마커에 충전소 정보 저장 (마커 생성 직후, 이벤트 리스너 등록 전에 반드시 실행)
            marker.station = st;
            markerStationMap.set(marker, st);
            markers.push(marker);
            markersToAdd.push(marker);
        }

        markerIndex = endIndex;

        // 다음 배치 처리
        if (markerIndex < visibleStations.length) {
            // requestAnimationFrame으로 다음 배치 처리 (메인 스레드 블로킹 방지)
            requestAnimationFrame(processBatch);
        } else {
            // 모든 마커 생성 완료 - 이벤트 리스너 추가 및 지도에 표시
            if (currentLevel >= 1 && currentLevel <= 5) {
                // 레벨 1, 2, 3, 4, 5일 때는 클릭 이벤트 추가
                markersToAdd.forEach(marker => {
                    const st = marker.station;
                    kakao.maps.event.addListener(marker, 'click', function(mouseEvent) {
                        if (typeof window.setMarkerClickFlag === 'function') {
                            window.setMarkerClickFlag(true);
                        }
                        if (mouseEvent && mouseEvent.stopPropagation) {
                            mouseEvent.stopPropagation();
                        }
                        let clickLat = st.lat;
                        let clickLng = st.lng;
                        if (mouseEvent && mouseEvent.latLng) {
                            clickLat = mouseEvent.latLng.getLat();
                            clickLng = mouseEvent.latLng.getLng();
                        }
                        // 🔥 클릭된 마커를 직접 사용 (거리 검색은 같은 위치에 여러 충전소가 있을 때만)
                        let targetMarker = marker;
                        let targetStation = markerStationMap.get(marker) || marker.station || st;
                        
                        // 같은 위치에 여러 충전소가 있는 경우만 거리 검색
                        const nearbyMarkers = markers.filter(m => {
                            const mStation = markerStationMap.get(m) || m.station;
                            if (!mStation) return false;
                            const distance = Math.sqrt(
                                Math.pow(clickLat - mStation.lat, 2) +
                                Math.pow(clickLng - mStation.lng, 2)
                            );
                            return distance < 0.0001; // 약 10m 이내
                        });
                        
                        // 같은 위치에 여러 충전소가 있으면 가장 가까운 것 선택
                        if (nearbyMarkers.length > 1) {
                            let minDistance = Infinity;
                            nearbyMarkers.forEach(m => {
                                const mStation = markerStationMap.get(m) || m.station;
                                if (mStation) {
                                    const distance = Math.sqrt(
                                        Math.pow(clickLat - mStation.lat, 2) +
                                        Math.pow(clickLng - mStation.lng, 2)
                                    );
                                    if (distance < minDistance) {
                                        minDistance = distance;
                                        targetMarker = m;
                                        targetStation = mStation;
                                    }
                                }
                            });
                        }
                        
                        // 마커 강조 및 확대
                        highlightMarker(targetMarker, targetStation);
                        setMapCenterAndLevel(targetStation.lat, targetStation.lng, 2, true);
                        setTimeout(() => {
                            showStationDetail(targetStation);
                            if (typeof window.setMarkerClickFlag === 'function') {
                                setTimeout(() => {
                                    window.setMarkerClickFlag(false);
                                }, 50);
                            }
                        }, 50);
                    });
                });
            }

            // 지도에 일괄 추가 또는 클러스터 사용
            // 같은 위치에 있는 마커들을 감지하여 클러스터 사용 여부 결정
            const positionGroups = new Map();
            const positionThreshold = 0.0001; // 약 10m 이내를 같은 위치로 간주

            markers.forEach(marker => {
                const station = markerStationMap.get(marker) || marker.station;
                if (station && station.lat && station.lng) {
                    // 같은 위치 그룹 찾기
                    let foundGroup = null;
                    for (const [key, group] of positionGroups.entries()) {
                        const [groupLat, groupLng] = key.split(',').map(Number);
                        const distance = Math.sqrt(
                            Math.pow(station.lat - groupLat, 2) +
                            Math.pow(station.lng - groupLng, 2)
                        );
                        if (distance < positionThreshold) {
                            foundGroup = key;
                            break;
                        }
                    }

                    if (foundGroup) {
                        positionGroups.get(foundGroup).push(marker);
                    } else {
                        const key = `${station.lat},${station.lng}`;
                        positionGroups.set(key, [marker]);
                    }
                }
            });

            // 같은 위치에 2개 이상의 마커가 있는지 확인
            const hasOverlappingMarkers = Array.from(positionGroups.values()).some(group => group.length > 1);
            // 클러스터 사용 여부 결정: 레벨이 6 이상이고 마커가 2개 이상이면 클러스터 사용
            const useCluster = currentLevel >= 6 && markers.length >= 2 && typeof kakao.maps.MarkerClusterer !== 'undefined';

            console.log(`[displayMarkersFallback] 완료: ${markers.length}개 마커, 클러스터 사용: ${useCluster}`);

            if (markers.length > 0) {
                // 레벨 1, 2, 3, 4, 5일 때는 무조건 개별 마커만 표시 (클러스터 사용 안 함)
                // 레벨 6 이상에서만 클러스터 사용
                if (currentLevel <= 5 || !useCluster || typeof kakao.maps.MarkerClusterer === 'undefined') {
                    // 개별 마커 표시 (이미 markersToAdd에 있음)
                    markersToAdd.forEach(marker => {
                        marker.setMap(map);
                    });
                } else {
                    // 클러스터 모드
                    if (typeof window.createMarkerClusterer === 'function') {
                        const createdClusterer = window.createMarkerClusterer(markers, currentLevel);
                        if (!createdClusterer) {
                            // 클러스터 생성 실패 시 개별 마커로 표시
                            markersToAdd.forEach(marker => marker.setMap(map));
                        }
                    } else {
                        // cluster.js 함수가 없으면 개별 마커로 표시
                        markersToAdd.forEach(marker => marker.setMap(map));
                    }
                }
            }
        }
    };

    // 첫 배치 시작
    processBatch();
    }
}

// 지도 이벤트 리스너 설정
function setupMapEventListeners(onDragEnd, onCenterChanged, onZoomChanged) {
    const map = getMap();
    if (!map) return;

    // 레벨 기반 강제 닫기 함수 (무조건 100% 닫기)
    window.forceCloseByLevel = function() {
        // ⭐ 사이드바에서 눌러서 확대하는 중이면 절대 닫지 않음
        if (window._sidebarSelection) {
            return;
        }
        
        // 오버레이가 열린 직후 200ms 동안은 닫지 않음 (마커/사이드바 클릭으로 인한 레벨 변경 무시)
        if (window.overlayOpenedAt > 0 && Date.now() - window.overlayOpenedAt < 200) {
            return;
        }

        const level = map.getLevel();
        // 레벨 2 이상이면 무조건 닫기 (절대 예외 없음)
        if (level >= 2) {
            window.closeOverlayNow(true); // 강제 삭제 모드
        }
    };

    // 오버레이를 닫는 함수 (강제 삭제 모드 추가)
    window.closeOverlayNow = function(force = false) {
        // 1) CustomOverlay 제거
        if (window.currentOverlay) {
            try {
                window.currentOverlay.setMap(null);
                window.currentOverlay = null;
            } catch (e) {
                console.warn('[closeOverlayNow] CustomOverlay 제거 실패:', e);
            }
        }

        // 2) sidebar.js의 closeMapOverlay도 호출 (이중 안전장치)
        if (typeof window.closeMapOverlay === 'function') {
            try {
                window.closeMapOverlay();
            } catch (e) {
                console.warn('[closeOverlayNow] closeMapOverlay 호출 실패:', e);
            }
        }

        // 3) 강제 삭제 모드: 모든 종류의 오버레이 DOM 요소 삭제
        if (force) {
            try {
                // 정확한 오버레이 클래스만 타겟팅
                const overlaySelectors = [
                    '.custom-overlay-container',
                    '.custom-overlay'
                ];

                overlaySelectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => {
                            if (el && el.parentNode) {
                                // 카카오맵이 생성한 오버레이 DOM 제거
                                el.remove();
                            }
                        });
                    } catch (e) {
                        // selector 오류 무시
                    }
                });

                // 추가로 map 내부의 오버레이 요소도 확인
                const mapContainer = document.getElementById('map');
                if (mapContainer) {
                    const mapOverlays = mapContainer.querySelectorAll('.custom-overlay-container, .custom-overlay');
                    mapOverlays.forEach(el => {
                        if (el && el.parentNode) {
                            el.remove();
                        }
                    });
                }
            } catch (e) {
                console.warn('[closeOverlayNow] 강제 DOM 삭제 실패:', e);
            }
        }
    };

    // 내부에서도 사용할 수 있도록 로컬 변수에도 할당
    const closeOverlayNow = window.closeOverlayNow;

    // ============================
    // center_changed (드래그 중 중심 변경 감지)
    // ============================
    kakao.maps.event.addListener(map, 'center_changed', () => {
        // 레벨 기반 강제 닫기 (드래그 시에도 레벨 체크)
        window.forceCloseByLevel();
    });

    // ============================
    // zoom_changed (즉각 반응)
    // ============================
    kakao.maps.event.addListener(map, 'zoom_changed', () => {
        // 🔥 사이드바 클릭으로 강제 확대한 경우 → zoom_changed 무시!!
        if (window._lockZoomChange) {
            console.log("[zoom_changed] 사이드바 강제 이동 중 → 무시됨");
            return;
        }
        
        // 🔥 사이드바 클릭 시 확대하는 동안 업데이트 차단
        if (window._blockMapUpdate) {
            console.log("[zoom_changed] 사이드바 확대 중 → 업데이트 차단됨");
            return;
        }
        
        // ⭐ 사이드바 클릭이면 강제 닫기 비활성화
        if (!window._blockZoomForce) {
            // 레벨 기반 강제 닫기 (무조건 100% - 타이밍 무관)
            window.forceCloseByLevel();
        }

        window._ignoreIdle = true;
        setTimeout(() => {
            window._ignoreIdle = false;
        }, 250);

        if (typeof window.updateStationsOnMapChange === 'function') {
            window.updateStationsOnMapChange();
        }

        if (onZoomChanged) onZoomChanged();
    });

    // ============================
    // idle (드래그 종료)
    // ============================
    kakao.maps.event.addListener(map, 'idle', () => {
        // 🔥 사이드바 클릭 시 확대하는 동안 업데이트 차단
        if (window._blockMapUpdate) {
            console.log("[idle] 사이드바 확대 중 → 업데이트 차단됨");
            return;
        }
        
        // ① zoom_changed 직후의 idle 무시
        if (window._ignoreIdle) {
            console.log("[idle] zoom_changed 직후 → 무시됨");
            return;
        }

        // ② 클러스터 클릭 중이면 idle 무시
        if (window._clusterClickInProgress) {
            console.log("[idle] 클러스터 클릭 중 → 무시");
            return;
        }

        // ③ idle 업데이트가 이미 실행 중이면 무시
        if (window._idleUpdateInProgress) {
            return;
        }

        // ④ throttle (너무 자주 실행되는 idle 방지)
        const now = Date.now();
        if (now - lastIdleTime < IDLE_THROTTLE_MS) {
            return;
        }
        lastIdleTime = now;

        // ===============================
        // ★ 드래그 종료된 idle에서만 실행
        // ===============================
        console.log("[idle] 드래그 종료 → updateStationsOnMapChange 실행됨");

        // 드래그 종료 시 상세정보 오버레이 닫기 (레벨 기반 강제 닫기)
        window.forceCloseByLevel();

        window._idleUpdateInProgress = true;

        if (typeof window.updateStationsOnMapChange === "function") {
            window.updateStationsOnMapChange();
        }

        window._idleUpdateInProgress = false;
    });

    // dragend — 버튼 텍스트 변경용
    if (onDragEnd) {
        kakao.maps.event.addListener(map, "dragend", onDragEnd);
    }

    // center_changed는 아무것도 안 함
    if (onCenterChanged) {
        kakao.maps.event.addListener(map, "center_changed", onCenterChanged);
    }
}

// 지도 중심 이동
function panToMap(lat, lng) {
    if (!map) return;
    const pos = new kakao.maps.LatLng(lat, lng);
    map.panTo(pos);
}

// 지도 중심 및 레벨 설정
function setMapCenterAndLevel(lat, lng, level, force = false) {
    if (!map) return;
    const pos = new kakao.maps.LatLng(lat, lng);
    
    if (force) {
        // 🔥 강제 확대 시 zoom_changed / idle 이벤트의 방해 방지
        window._ignoreIdle = true;
        window._ignoreZoomClose = true;
        setTimeout(() => {
            window._ignoreIdle = false;
            window._ignoreZoomClose = false;
        }, 300);
        
        // 즉시 반영
        map.setCenter(pos);
        map.setLevel(level, { anchor: pos });
        return;
    }
    
    if (level) {
        // force가 false일 때: 현재 레벨이 더 확대되어 있으면 변경하지 않음
        const currentLevel = map.getLevel();
        if (currentLevel < level) {
            // 이미 더 확대되어 있으면 레벨 변경하지 않음
            map.setCenter(pos);
            return;
        }
        // 중심을 먼저 이동한 후 레벨 변경 (더 안정적)
        map.setCenter(pos);
        // 중심 이동이 완료된 후 레벨 변경 (anchor 옵션 사용)
        setTimeout(() => {
            map.setLevel(level, { anchor: pos });
        }, 50);
    } else {
        // 레벨이 없으면 중심만 이동
        map.setCenter(pos);
    }
}

// 지도 중심 좌표 가져오기
function getMapCenter() {
    if (!map) return null;
    const center = map.getCenter();
    return { lat: center.getLat(), lng: center.getLng() };
}

// 지도 레벨 가져오기
function getMapLevel() {
    if (!map) return 9;
    return map.getLevel();
}

// 지도 화면 영역(bounds) 가져오기
function getMapBounds() {
    if (!map) return null;

    // Kakao Maps의 getBounds() 메서드로 현재 화면 영역 가져오기
    try {
        const bounds = map.getBounds();
        if (bounds) {
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();

            // bounds가 유효한지 확인
            if (sw && ne &&
                sw.getLat() >= -90 && sw.getLat() <= 90 &&
                ne.getLat() >= -90 && ne.getLat() <= 90 &&
                sw.getLng() >= -180 && sw.getLng() <= 180 &&
                ne.getLng() >= -180 && ne.getLng() <= 180 &&
                sw.getLat() < ne.getLat() && sw.getLng() < ne.getLng()) {
                return bounds;
            }
        }
    } catch (e) {
        console.warn('getBounds() 오류:', e);
    }

    // bounds를 가져올 수 없으면 지도 컨테이너 크기로 계산
    const center = map.getCenter();
    const level = map.getLevel();
    if (!center) return null;

    // 지도 컨테이너 크기 가져오기
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return null;

    const containerWidth = mapContainer.offsetWidth;
    const containerHeight = mapContainer.offsetHeight;

    // 레벨에 따른 픽셀당 미터 계산 (대략적)
    // 레벨 1: 약 0.5m/pixel, 레벨 10: 약 500m/pixel
    const metersPerPixel = 156543.03392 * Math.cos(center.getLat() * Math.PI / 180) / Math.pow(2, level);

    // 화면 크기를 미터로 변환
    const widthMeters = containerWidth * metersPerPixel;
    const heightMeters = containerHeight * metersPerPixel;

    // 미터를 위도/경도로 변환 (위도 1도 ≈ 111km, 경도는 위도에 따라 다름)
    const latDelta = heightMeters / 2 / 111000;
    const lngDelta = widthMeters / 2 / (111000 * Math.cos(center.getLat() * Math.PI / 180));

    const sw = new kakao.maps.LatLng(
        center.getLat() - latDelta,
        center.getLng() - lngDelta
    );
    const ne = new kakao.maps.LatLng(
        center.getLat() + latDelta,
        center.getLng() + lngDelta
    );

    return new kakao.maps.LatLngBounds(sw, ne);
}

// 사용자 위치 가져오기
function getUserLocation() {
    return userLocation;
}

// 모든 마커 가져오기 (전역 함수)
window.getAllMarkers = function() {
    return markers;
};

// 마커의 충전소 정보 가져오기 (전역 함수)
window.getMarkerStation = function(marker) {
    return markerStationMap.get(marker) || marker.station;
};

// 🔥 마커 상태 업데이트 함수 (예약 정보 변경 시 마커 색상 즉시 반영)
window.updateMarkerStates = function() {
    if (!markers || markers.length === 0) return;
    
    // 현재 활성화된 예약 정보 가져오기
    const activeReservations = window.activeReservations || [];
    
    // 색상 결정 함수
    const getMarkerColor = (st) => {
        if (!st.realtime || !Array.isArray(st.realtime)) return "gray";
        let available = 0, charging = 0, checking = 0;
        
        for (let i = 0; i < st.realtime.length; i++) {
            const r = st.realtime[i];
            const status = r.status || "정보없음";
            const chargerId = r.chgerId || i.toString();
            
            // 예약 시간대가 활성화된 경우 확인 (충전기 ID 일치만 체크)
            const isActiveReservation = activeReservations.some(ar =>
                ar.chargerId && String(ar.chargerId) === String(chargerId)
            );
            
            // 예약 시간대가 활성화된 경우 충전중으로 처리
            if (isActiveReservation && (status.includes("충전가능") || status.includes("정보없음"))) {
                charging++;
            }
            else if (status.includes("충전가능") || status.includes("정보없음")) {
                available++;
            }
            else if (status.includes("충전중")) {
                charging++;
            }
            else if (status.includes("점검중")) {
                checking++;
            }
        }
        if (available > 0) return "green";
        if (charging > 0) return "red";
        if (checking > 0) return "orange";
        return "gray";
    };
    
    // 모든 마커의 색상 업데이트 (확대된 마커는 크기 유지)
    markers.forEach(marker => {
        const st = markerStationMap.get(marker) || marker.station;
        if (!st) return;
        
        // 확대된 마커(selectedMarker)는 크기 유지하면서 색상만 업데이트
        if (selectedMarker === marker) {
            const color = getMarkerColor(st);
            const src = color === 'green' ? getImagePath('g.png')
                : color === 'red' ? getImagePath('r.png')
                : getImagePath('o.png');
            const largeSize = new kakao.maps.Size(48, 48);
            const largeOptions = {
                offset: new kakao.maps.Point(24, 48)
            };
            const largeImage = new kakao.maps.MarkerImage(src, largeSize, largeOptions);
            marker.setImage(largeImage);
        } else {
            // 일반 마커는 원래 크기로 업데이트
            const color = getMarkerColor(st);
            const newImage = createMarkerImage(color);
            marker.setImage(newImage);
        }
    });
    
    console.log('✅ 마커 상태 업데이트 완료:', markers.length, '개 마커');
};

// 클러스터 객체 가져오기 (전역 함수 - cluster.js에서 사용)
window.getClusterer = function() {
    if (typeof window.getClustererFromCluster === 'function') {
        return window.getClustererFromCluster();
    }
    return null;
};

// 클러스터 객체 설정 (전역 함수 - cluster.js에서 사용)
window.setClusterer = function(newClusterer) {
    // cluster.js의 clusterer 변수는 직접 접근할 수 없으므로
    // cluster.js에서 내부적으로 관리하도록 함
    // 이 함수는 호환성을 위해 유지하지만 실제로는 cluster.js에서 관리
};

// 마커 추가 (전역 함수 - cluster.js에서 사용)
window.addMarker = function(marker) {
    if (marker && !markers.includes(marker)) {
        markers.push(marker);
    }
};

// 마커 배열 가져오기 (전역 함수 - cluster.js에서 사용)
window.getMarkers = function() {
    return markers;
};
