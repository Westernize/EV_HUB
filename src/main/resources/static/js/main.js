// 메인 진입점 및 초기화

let isFirstLoad = true;
let updateStationsFn = null;

// 실시간 지도 업데이트를 위한 debounce 변수 (최소한의 지연만)
let mapUpdateTimer = null;
const MAP_UPDATE_DELAY = 100; // 100ms 지연 (성능 최적화를 위한 최소 지연)

// MarkerClusterer 로드 대기
function waitForClusterer(callback, maxAttempts = 50) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;
        if (typeof kakao !== 'undefined' && typeof kakao.maps !== 'undefined' && typeof kakao.maps.MarkerClusterer !== 'undefined') {
            clearInterval(checkInterval);
            console.log('MarkerClusterer 라이브러리 로드 완료');
            callback();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            console.warn('MarkerClusterer 라이브러리 로드 실패. 마커를 직접 표시합니다.');
            callback();
        }
    }, 100);
}

// 충전소 업데이트 함수 (전역 함수로 등록하여 idle 이벤트에서 호출 가능하도록)
function updateStations(opts = {}) {
    const searchBox = document.getElementById('searchBox');
    const searchBtn = document.getElementById('searchBtn');

    // 처음 로드 시: 레벨에 따라 결정
    if (isFirstLoad && !opts.useBounds) {
        const currentLevel = getMapLevel();
        // 레벨이 낮을 때(축소 상태, 레벨 7 이상): 모든 충전소 표시
        // 레벨이 높을 때(확대 상태, 레벨 6 이하): 화면에 보이는 영역만 표시
        if (currentLevel < 7) {
            opts.useBounds = true;
        }
        opts.forceCenterSearch = true;
    }

    const forceCenterSearch = !!opts.center || !!opts.forceCenterSearch;
    const rawKeyword = forceCenterSearch ? '' : ((typeof opts.keyword !== 'undefined') ? opts.keyword : (searchBox ? searchBox.value : ''));
    const keyword = (rawKeyword || '').trim().toLowerCase();
    
    // 🔥 검색 키워드가 있으면 자동 이동 완전 비활성화 (검색은 한 번만 이동)
    const hasSearchKeyword = keyword && keyword.length > 0;
    const hasGlobalSearchKeyword = window.lastSearchKeyword && window.lastSearchKeyword.trim().length > 0;

    // 필터링된 충전소 가져오기
    const filteredStations = filterStations(opts);

    // 자동 이동 코드 완전 차단 (삭제됨)

    // 사이드바에 표시 (새 검색이므로 페이지를 1로 리셋)
    window.currentPage = 1;
    displaySidebarStations(filteredStations);

    // 현재 충전소 목록 저장 (지도 레벨 변경 시 마커 다시 표시용)
    window.currentStations = filteredStations;

    // 지도에 마커 표시
    displayMarkers(filteredStations, opts);

    // 검색 버튼 업데이트
    if (searchBtn) {
        searchBtn.style.background = "#0078ff";
        searchBtn.innerText = keyword
            ? `🔍 ${filteredStations.length}개 검색 결과`
            : `📍 ${filteredStations.length}개 충전소 표시됨`;
    }

    isFirstLoad = false;
}

// 실시간 지도 업데이트 함수 (zoom_changed 이벤트에서 호출)
// 전역 함수로 노출 (map.js에서 마우스 휠 이벤트에서 호출)
// 무조건 즉각 반응 (주작을 쳐서라도!)
window.updateStationsOnMapChange = function() {
    // 업데이트 중이면 차단 (중복 업데이트 방지)
    if (window._updateInProgress) {
        return; // 로그 제거로 성능 향상
    }

    const currentLevel = getMapLevel();

    // 업데이트 시작 플래그 설정
    window._updateInProgress = true;

    console.log(`🔄 [updateStationsOnMapChange] 레벨 ${currentLevel} - 업데이트 시작`);

    // 레벨 5 이하 → 무조건 개별 마커 (클러스터 완전 금지)
    // 확대할 때마다 해당 영역(bounds)의 마커를 실시간으로 표시
    if (currentLevel <= 5) {
        console.log(`[updateStationsOnMapChange] 레벨 ${currentLevel} (5 이하) → bounds 기반 개별 마커 표시`);
        // 항상 bounds 기반으로 현재 화면 영역의 마커를 가져와서 표시
        if (typeof window.updateStations === 'function') {
            window.updateStations({
                skipAutoMove: true,
                useBounds: true,
                forceCenterSearch: true,
                forceIndividualMarkers: true
            });
        }
        window._updateInProgress = false;
        return;
    }

    // 레벨 6~10 → 클러스터 표시
    if (currentLevel >= 6 && currentLevel <= 10) {
        console.log(`[updateStationsOnMapChange] 레벨 ${currentLevel} (6~10) - 클러스터 표시 시작`);

        // 기존 마커/클러스터 제거
        if (typeof window.clearMarkers === 'function') {
            window.clearMarkers();
        }
        if (typeof window.clearClusterOverlays === 'function') {
            window.clearClusterOverlays();
        }
        if (typeof window.clearRegionMarkers === 'function') {
            window.clearRegionMarkers();
        }

        if (typeof window.fetchClustersFromAPI === 'function') {
            try {
                console.log(`[updateStationsOnMapChange] fetchClustersFromAPI 호출 중...`);
                const clusters = window.fetchClustersFromAPI();
                console.log(`[updateStationsOnMapChange] 클러스터 계산 완료: ${clusters ? clusters.length : 0}개`);

                if (clusters && clusters.length > 0) {
                    if (typeof window.displayClusterMarkers === 'function') {
                        console.log(`[updateStationsOnMapChange] displayClusterMarkers 호출 중...`);
                        window.displayClusterMarkers(clusters);
                        console.log(`[updateStationsOnMapChange] 클러스터 표시 완료`);
                    } else {
                        console.error('[updateStationsOnMapChange] displayClusterMarkers 함수가 없습니다.');
                    }
                } else {
                    console.warn(`[updateStationsOnMapChange] 레벨 ${currentLevel} - 클러스터가 없습니다. (allStations 데이터 확인 필요)`);
                }
            } catch (error) {
                console.error('[updateStationsOnMapChange] 클러스터 계산 오류:', error);
                console.error(error.stack);
            }
        } else {
            console.error('[updateStationsOnMapChange] fetchClustersFromAPI 함수가 없습니다.');
        }
        window._updateInProgress = false;
        return;
    }

    // 레벨 11 이상에서만 Delta Area 기반으로 처리
    if (typeof window.getDeltaArea === 'function') {
        const deltaArea = window.getDeltaArea();
        console.log(`[updateStationsOnMapChange] Delta Area: ${deltaArea}, 레벨: ${currentLevel}`);

        if (deltaArea === 'max') {
            // 레벨 11 이상: 지역 마커 표시
            console.log(`[updateStationsOnMapChange] 레벨 ${currentLevel} (11 이상) - 지역 마커 표시`);
            if (typeof window.fetchRegionsFromAPI === 'function') {
                window.fetchRegionsFromAPI().then(regions => {
                    if (regions.length > 0 && typeof window.displayRegionMarkers === 'function') {
                        window.displayRegionMarkers(regions);
                    }
                    window._updateInProgress = false;
                }).catch(() => {
                    window._updateInProgress = false;
                });
            } else {
                window._updateInProgress = false;
            }
        } else if (deltaArea === 'large') {
            // 클러스터 표시
            if (typeof window.fetchClustersFromAPI === 'function') {
                try {
                    const clusters = window.fetchClustersFromAPI();
                    if (clusters && clusters.length > 0 && typeof window.displayClusterMarkers === 'function') {
                        window.displayClusterMarkers(clusters);
                    }
                } catch (error) {
                    console.error('클러스터 계산 오류:', error);
                }
                window._updateInProgress = false;
            } else {
                window._updateInProgress = false;
            }
        } else {
            // 개별 마커 표시
            if (typeof window.updateStations === 'function') {
                window.updateStations({
                skipAutoMove: true,  // 자동 이동 방지
                    useBounds: true,
                    forceCenterSearch: true,
                    forceIndividualMarkers: true
                });
            }
            window._updateInProgress = false;
        }
    } else {
        // getDeltaArea가 없으면 기본 처리
        if (typeof window.updateStations === 'function') {
            window.updateStations({
                skipAutoMove: true,  // 자동 이동 방지
                useBounds: true,
                forceCenterSearch: true
            });
        }
        window._updateInProgress = false;
    }
}

// 지도 이벤트 핸들러
function onMapDragEnd() {
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.style.background = '#00a000';
        searchBtn.innerText = '🔍 현 지도에서 검색';
    }

    // 드래그 종료 시 대기 중인 타이머 취소하고 즉시 업데이트
    if (mapUpdateTimer) {
        clearTimeout(mapUpdateTimer);
        mapUpdateTimer = null;
    }

    const currentLevel = getMapLevel();

    // 레벨이 낮을 때(축소 상태, 레벨 7 이상): 모든 충전소 표시
    // 레벨이 높을 때(확대 상태, 레벨 6 이하): 화면에 보이는 영역만 표시
    if (currentLevel >= 7) {
        // 전국 충전소 모두 표시
        updateStations({
            forceCenterSearch: true,
            skipAutoMove: true  // 자동 이동 방지
        });
    } else {
        // 화면에 보이는 영역(bounds) 내의 충전소만 표시
        updateStations({
            useBounds: true,
            forceCenterSearch: true,
            skipAutoMove: true  // 자동 이동 방지
        });
    }
}

// 지도 중심 변경 이벤트 핸들러 (실시간 업데이트)
function onMapCenterChanged() {
    // 지도 중심이 변경될 때마다 업데이트 (드래그 중에도 발생)
    updateStationsOnMapChange();
}

// 마커 클릭으로 인한 줌 변경인지 확인하는 플래그
let isMarkerZoomChange = false;

// 전역 함수로 플래그 설정 (클러스터 클릭에서도 사용)
window.setMarkerZoomChange = function(value) {
    isMarkerZoomChange = value;
};

function onMapZoomChanged() {
    // 마커 클릭으로 인한 줌 변경이면 무시
    if (isMarkerZoomChange) {
        isMarkerZoomChange = false;
        return;
    }

    const currentLevel = getMapLevel();
    console.log(`[onMapZoomChanged] 줌 변경 이벤트 발생, 현재 레벨: ${currentLevel}`);

    // 줌 변경 시 실시간 업데이트
    // idle 이벤트가 발생할 때까지 기다리지 않고 즉시 업데이트
    updateStationsOnMapChange();
}

// 예약하기 함수 (전역)
window.handleReserve = function(chgerId, stationName) {
    if (typeof openReservationModal === 'function') {
        openReservationModal(chgerId, stationName);
    } else {
        alert(`충전소: ${stationName}\n충전기 ID: ${chgerId}\n\n예약 기능이 곧 제공될 예정입니다.`);
    }
};

// 지도 팝업 닫기 버튼
function initDetailClose() {
    const detailClose = document.getElementById('detail-close');
    if (detailClose) {
        detailClose.addEventListener('click', () => {
            const detailBox = document.getElementById('station-detail');
            if (detailBox) {
                detailBox.classList.remove('active');
            }
        });
    }
}

// 초기화
function init() {
    // 로그인 후 리다이렉트인 경우 로딩 애니메이션 건너뛰기
    const urlParams = new URLSearchParams(window.location.search);
    const isLoginSuccess = urlParams.get('login') === 'success';
    
    if (!isLoginSuccess) {
        // 로딩 애니메이션 시작
        startLoadingAnimation();
    } else {
        // 로그인 후에는 로딩창 숨기고 바로 표시
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        // 지도와 사이드바 바로 표시
        const mapElement = document.getElementById('map');
        const sidebarElement = document.getElementById('sidebar');
        if (mapElement) mapElement.classList.add('loaded');
        if (sidebarElement) sidebarElement.classList.add('loaded');
        document.body.classList.add('loaded');
    }

    // 지도 초기화
    initMap();

    // 지도 이벤트 리스너 설정 (실시간 업데이트 포함)
    // zoom_changed 이벤트는 직접 onMapZoomChanged 함수를 전달
    setupMapEventListeners(onMapDragEnd, onMapCenterChanged, onMapZoomChanged);

    // 지도 클릭 시 오버레이 닫기 및 주변 마커 감지
    const mapObj = getMap();
    if (mapObj) {
        // 마커 클릭 플래그 (마커 클릭 시 지도 클릭 이벤트 무시)
        let isMarkerClick = false;

        // 지도 클릭 이벤트 - 모든 마커 클릭을 처리 (겹쳐있는 마커도 클릭 가능)
        kakao.maps.event.addListener(mapObj, 'click', function(mouseEvent) {
            // 마커 클릭 플래그가 설정되어 있으면 무시 (오버레이 링크 클릭 시)
            if (isMarkerClick) {
                return;
            }
            // 클릭한 위치의 좌표 가져오기
            const latlng = mouseEvent.latLng;
            if (!latlng) {
                // 지도 빈 공간 클릭인 경우 오버레이 닫기
                if (typeof window.closeMapOverlay === 'function') {
                    window.closeMapOverlay();
                }
                return;
            }

            // 주변 마커 찾기 (클릭한 위치에서 가까운 마커)
            const clickLat = latlng.getLat();
            const clickLng = latlng.getLng();

            // 마커 목록 가져오기 (전역 변수 또는 함수를 통해)
            if (typeof window.getAllMarkers === 'function') {
                const allMarkers = window.getAllMarkers();
                if (!allMarkers || allMarkers.length === 0) {
                    // 마커가 없으면 오버레이만 닫기
                    if (typeof window.closeMapOverlay === 'function') {
                        window.closeMapOverlay();
                    }
                    return;
                }

                let closestMarker = null;
                let minDistance = Infinity;

                // 줌 레벨에 따라 클릭 반경 조정 (레벨이 낮을수록 더 넓은 반경)
                const currentLevel = mapObj.getLevel();
                // 겹쳐있는 마커도 클릭할 수 있도록 반경을 넓게 설정
                const clickRadius = currentLevel > 5 ? 0.0005 : currentLevel > 3 ? 0.0008 : 0.0012; // 약 50-120m 반경

                allMarkers.forEach(marker => {
                    const station = marker.station || window.getMarkerStation(marker);
                    if (station && station.lat && station.lng) {
                        const distance = Math.sqrt(
                            Math.pow(station.lat - clickLat, 2) +
                            Math.pow(station.lng - clickLng, 2)
                        );

                        // 클릭 위치에 가장 가까운 마커 찾기
                        if (distance < clickRadius && distance < minDistance) {
                            minDistance = distance;
                            closestMarker = { marker, station };
                        }
                    }
                });

                // 가까운 마커가 있으면 해당 마커 클릭 처리
                if (closestMarker) {
                    console.log('마커 선택:', closestMarker.station.name, '거리:', minDistance);

                    // 마커 클릭으로 인한 줌 변경 플래그 설정
                    if (typeof window.setMarkerZoomChange === 'function') {
                        window.setMarkerZoomChange(true);
                    }

                    if (typeof highlightMarker === 'function') {
                        highlightMarker(closestMarker.marker, closestMarker.station);
                    }
                    if (typeof setMapCenterAndLevel === 'function') {
                        setMapCenterAndLevel(closestMarker.station.lat, closestMarker.station.lng, 2, true); // force: true로 강제 확대
                    }

                    // 플래그 리셋 (줌 변경 이벤트가 처리될 시간 확보)
                    setTimeout(() => {
                        if (typeof window.setMarkerZoomChange === 'function') {
                            window.setMarkerZoomChange(false);
                        }
                    }, 500);

                    setTimeout(() => {
                        if (typeof showStationDetail === 'function') {
                            showStationDetail(closestMarker.station);
                        }
                    }, 50);
                    return;
                }
            }
            // 지도 빈 공간 클릭인 경우에만 오버레이 닫기
            if (typeof window.closeMapOverlay === 'function') {
                window.closeMapOverlay();
            }
        });

        // 전역 변수로 마커 클릭 플래그 설정 함수 제공
        window.setMarkerClickFlag = function(value) {
            isMarkerClick = value;
        };
    }

    // 충전소 데이터 로드
    loadStations()
        .then(() => {
            // 로그인 후가 아니면 로딩 완료 처리
            if (!isLoginSuccess) {
                finishLoading();
            }
            // updateStations를 전역 함수로 등록 (idle 이벤트에서 호출 가능하도록)
            window.updateStations = updateStations;
            updateStations();
        })
        .catch(err => {
            // 로그인 후가 아니면 에러 처리
            if (!isLoginSuccess) {
                handleLoadingError(err);
            } else {
                console.error('데이터 로드 실패:', err);
            }
        });

    // 검색 초기화
    initSearch(updateStations);

    // 필터 초기화
    initFilters(updateStations);

    // 메뉴 초기화
    initMenu();

    // 로그인/회원가입 초기화
    if (typeof initAuth === 'function') {
        initAuth();
    }

    // 예약 기능 초기화
    if (typeof initReservation === 'function') {
        initReservation();
    }

    // 상세정보 닫기 버튼 초기화
    initDetailClose();
}

// Kakao Map API 로드 후 초기화
kakao.maps.load(() => {
    waitForClusterer(() => {
        init();
    });
});

