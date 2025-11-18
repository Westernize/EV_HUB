// 충전소 데이터 처리 및 표시

let allStations = [];
let lastSearchCenter = null;

// 충전소 데이터 로드
function loadStations() {
    return fetch('/api/ev/all')
        .then(res => {
            if (!res.ok) {
                // 더 자세한 에러 정보
                const errorMsg = `HTTP error! status: ${res.status} ${res.statusText}`;
                console.error('API 응답 오류:', errorMsg);
                console.error('응답 URL:', res.url);
                throw new Error(errorMsg);
            }
            return res.json();
        })
        .then(data => {
            if (!data || !Array.isArray(data)) {
                throw new Error('데이터 형식이 올바르지 않습니다. 배열이 아닙니다.');
            }
            allStations = data;
            window.allStations = data; // cluster.js에서 접근 가능하도록 전역 노출
            console.log(`✅ 충전소 데이터 로드 완료: ${data.length}개`);
            return data;
        })
        .catch(error => {
            // 네트워크 오류인지 확인
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.error('❌ 네트워크 오류: 서버에 연결할 수 없습니다.');
                throw new Error('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.');
            }
            // 기타 오류
            console.error('❌ 데이터 로드 오류:', error);
            throw error;
        });
}

// 충전소 필터링
function filterStations(opts = {}) {
    const forceCenterSearch = !!opts.center || !!opts.forceCenterSearch;
    const rawKeyword = forceCenterSearch ? '' : ((typeof opts.keyword !== 'undefined') ? opts.keyword : '');
    const keyword = (rawKeyword || '').trim().toLowerCase();
    const mapObj = getMap();
    if (!mapObj) return [];

    const selectedTypes = getSelectedChargerTypes();
    const filterAvailable = document.getElementById('filter-available')?.classList.contains('active') || false;
    const filterReservable = document.getElementById('filter-reservable')?.classList.contains('active') || false;

    // bounds 기반 필터링 (현 지도에서 검색 버튼 클릭 시)
    if (opts.useBounds) {
        const bounds = getMapBounds();
        if (!bounds) return [];

        // Kakao Maps의 LatLngBounds.contain() 메서드 사용
        const sw = bounds.getSouthWest(); // 남서쪽 좌표
        const ne = bounds.getNorthEast(); // 북동쪽 좌표

        const inRange = allStations.filter(st => {
            // 지도 화면 영역 내에 있는지 확인 (bounds.contain() 사용)
            const stationLatLng = new kakao.maps.LatLng(st.lat, st.lng);
            const inBounds = bounds.contain(stationLatLng);
            if (!inBounds) return false;

            const name = (st.name || '').toLowerCase();
            const addr = (st.addr || '').toLowerCase();
            const chargerType = (st.chargerType || '').trim();

            // 충전가능 필터
            if (filterAvailable) {
                let available = 0;
                if (st.realtime && Array.isArray(st.realtime)) {
                    st.realtime.forEach(r => {
                        const status = r.status || "정보없음";
                        if (status.includes("충전가능") || status.includes("정보없음")) available++;
                    });
                }
                if (available === 0) return false;
            }

            // 예약가능 필터
            if (filterReservable) {
                let hasAvailableCharger = false;
                if (st.realtime && Array.isArray(st.realtime)) {
                    st.realtime.forEach(r => {
                        const status = r.status || "정보없음";
                        if (status.includes("충전가능") || status.includes("정보없음")) {
                            hasAvailableCharger = true;
                        }
                    });
                }
                if (!hasAvailableCharger) return false;
            }

            // 충전기 타입 필터
            return matchChargerType(chargerType, selectedTypes);
        });

        return inRange;
    }

    // 기존 반경 기반 필터링 (드래그, 줌 변경 시)
    // 네이버 지도처럼: 지도 중심 기준으로 검색 (확대 레벨에 따라 반경 자동 조정)
    let center;
    if (opts.center) {
        // opts.center가 있으면 우선 사용 (드래그, 줌 변경 시 지도 중심)
        center = new kakao.maps.LatLng(opts.center.lat, opts.center.lng);
    } else {
        // opts.center가 없으면 현재 지도 중심 사용
        center = mapObj.getCenter();
    }
    // 반경은 opts.radiusKm이 있으면 사용, 없으면 현재 레벨에 맞는 반경 사용
    const radius = (typeof opts.radiusKm !== 'undefined') ? opts.radiusKm : getRadiusByLevel(mapObj.getLevel());

    const inRange = allStations.filter(st => {
        const d = getDistance(center.getLat(), center.getLng(), st.lat, st.lng);
        const name = (st.name || '').toLowerCase();
        const addr = (st.addr || '').toLowerCase();
        const chargerType = (st.chargerType || '').trim();

        // 충전가능 필터
        if (filterAvailable) {
            let available = 0;
            if (st.realtime && Array.isArray(st.realtime)) {
                st.realtime.forEach(r => {
                    const status = r.status || "정보없음";
                    if (status.includes("충전가능") || status.includes("정보없음")) available++;
                });
            }
            if (available === 0) return false;
        }

        // 예약가능 필터
        if (filterReservable) {
            let hasAvailableCharger = false;
            if (st.realtime && Array.isArray(st.realtime)) {
                st.realtime.forEach(r => {
                    const status = r.status || "정보없음";
                    if (status.includes("충전가능") || status.includes("정보없음")) {
                        hasAvailableCharger = true;
                    }
                });
            }
            if (!hasAvailableCharger) return false;
        }

        // 장소 중심 검색 - 네이버 지도처럼 현위치 기준으로만
        if (forceCenterSearch) {
            return matchChargerType(chargerType, selectedTypes) && d <= radius;
        }

        // 일반 키워드 검색 - 현위치 기준으로만
        const kw = keyword.trim().toLowerCase();
        let matchKeyword = false;

        const expandedKeywords = [kw];
        if (kw.endsWith("역")) expandedKeywords.push(kw.replace(/역$/, ""));
        if (kw.endsWith("대")) expandedKeywords.push(kw + "학교");
        if (kw.endsWith("동")) expandedKeywords.push(kw.replace(/동$/, ""));
        if (kw.endsWith("시")) expandedKeywords.push(kw.replace(/시$/, ""));

        if (!kw) {
            matchKeyword = true;
        } else {
            matchKeyword = expandedKeywords.some(k =>
                name.includes(k) || addr.includes(k)
            );
        }

        const matchType = matchChargerType(chargerType, selectedTypes);

        // 네이버 지도처럼 현위치 기준으로만 검색 (거리 제한 적용)
        return matchKeyword && matchType && (kw ? d <= 20 : d <= radius);
    });

    return inRange;
}

// 충전소 상태 아이콘 생성
function createStatusIcons(station, activeReservations = []) {
    let total = 0, available = 0, charging = 0, checking = 0, infoUnknown = 0;

    if (station.realtime && Array.isArray(station.realtime)) {
        total = station.realtime.length;

        station.realtime.forEach((r, index) => {
            const status = r.status || "정보없음";
            const chargerId = r.chgerId || index.toString();  // 유지

            // 🔧 수정된 부분 — 예약 충전기 매칭 방식 개선
            const isActiveReservation = activeReservations.some(ar => {

                // chargerId가 없으면 무시
                if (!ar.chargerId) return false;

                // 문자열로 강제 통일 → Number/String 충돌 제거
                const reservedId = String(ar.chargerId);
                const rtId = String(chargerId);

                // ★ 충전소 이름(placeName) 비교 제거
                //    동일 충전소인데 등록 방식 차이로 미묘하게 다르면 매칭 불가해짐
                return reservedId === rtId;
            });

            // 디버깅 그대로 유지
            if (activeReservations.length > 0) {
                const stationReservations = activeReservations.filter(ar => ar.placeName === station.name);
                if (stationReservations.length > 0 && (status.includes("충전가능") || status.includes("정보없음"))) {
                    console.log(`충전기 "${chargerId}" 상태 확인:`, {
                        status,
                        chargerId,
                        stationReservations: stationReservations.map(ar => ({
                            chargerId: ar.chargerId,
                            placeName: ar.placeName
                        })),
                        isActiveReservation
                    });
                }
            }

            // 예약 시간대 → 강제로 '충전중'
            if (isActiveReservation && (status.includes("충전가능") || status.includes("정보없음"))) {
                charging++;
            }
            // 정상 상태 처리
            else if (status.includes("충전가능") || status.includes("정보없음")) {
                available++;
                if (status.includes("정보없음")) infoUnknown++;
            }
            else if (status.includes("충전중")) {
                charging++;
            }
            else if (status.includes("점검중")) {
                checking++;
            }
        });
    }

    // 디버깅 유지
    if (activeReservations.length > 0) {
        const stationReservations = activeReservations.filter(ar => ar.placeName === station.name);
        if (stationReservations.length > 0) {
            console.log(`충전소 "${station.name}" 상태:`, {
                total,
                available,
                charging,
                checking,
                activeReservations: stationReservations.length,
                reservations: stationReservations
            });
        }
    }

    // 출력 그대로 유지
    let statusIcons = [];
    if (available > 0) {
        statusIcons.push(`<span style="color:#008000; font-weight:600;">
      <img src="${getImagePath('g.png')}" style="width:16px;height:16px;vertical-align:middle;margin-right:2px;">
      ${available}대 충전가능
    </span>`);
    }
    if (charging > 0) {
        statusIcons.push(`<span style="color:#d9534f; font-weight:600;">
      <img src="${getImagePath('r.png')}" style="width:16px;height:16px;vertical-align:middle;margin-right:2px;">
      ${charging}대 충전중
    </span>`);
    }
    if (checking > 0) {
        statusIcons.push(`<span style="color:#ff9900; font-weight:600;">
      <img src="${getImagePath('o.png')}" style="width:16px;height:16px;vertical-align:middle;margin-right:2px;">
      ${checking}대 점검중
    </span>`);
    }
    if (statusIcons.length === 0) {
        statusIcons.push(`<span style="color:#888;">정보없음</span>`);
    }

    return statusIcons;
}

// 검색 중심 위치 저장
function setLastSearchCenter(center) {
    lastSearchCenter = center;
}

// 검색 중심 위치 가져오기
function getLastSearchCenter() {
    return lastSearchCenter;
}

// 검색 중심 위치 초기화
function clearLastSearchCenter() {
    lastSearchCenter = null;
}

