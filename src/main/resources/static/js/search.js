// 검색 관련 기능

let debounceTimer = null;
let lastSearchKeyword = '';
let ps = null; // Places 서비스 객체

// 검색 초기화
function initSearch(updateStationsCallback) {
    const searchBox = document.getElementById('searchBox');
    const searchBtn = document.getElementById('searchBtn');

    if (!searchBox) return;

    // Places 서비스 객체 생성
    ps = new kakao.maps.services.Places();

    // Enter 키 검색
    searchBox.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const keyword = searchBox.value.trim();
            if (!keyword) return;

            clearTimeout(debounceTimer);
            lastSearchKeyword = keyword;

            ps.keywordSearch(keyword, (data, status) => {
                if (status === kakao.maps.services.Status.OK && data.length > 0) {
                    const first = data[0];
                    const pos = new kakao.maps.LatLng(first.y, first.x);

                    // 🔥 검색 완료 플래그 설정 (자동 이동 방지)
                    window._searchJustCompleted = true;
                    
                    // 검색 시 항상 레벨 4로 강제 설정 (force: true)
                    setMapCenterAndLevel(first.y, first.x, 4, true);
                    setLastSearchCenter({ lat: first.y, lng: first.x });

                    // 검색 키워드를 전역 변수로 저장 (자동 선택용)
                    window.lastSearchKeyword = keyword;

                    // 지도 이동 완료 후 주변 검색 실행 (넓은 범위로 충전소 표시)
                    setTimeout(() => {
                        if (updateStationsCallback) {
                            // bounds 기반 검색으로 화면에 보이는 모든 충전소 표시
                            updateStationsCallback({
                                useBounds: true,
                                forceCenterSearch: true,
                                skipAutoMove: true  // 자동 이동 방지
                            });
                        }
                        // 1초 후 검색 완료 플래그 해제
                        setTimeout(() => {
                            window._searchJustCompleted = false;
                        }, 1000);
                    }, 300);
                } else {
                    alert("검색 결과가 없습니다.");
                }
            });
        }
    });

    // 입력 검색 (debounce)
    searchBox.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const keyword = searchBox.value.trim();

        if (!keyword) {
            debounceTimer = setTimeout(() => {
                if (updateStationsCallback) updateStationsCallback();
            }, 1000);
            return;
        }

        if (keyword !== lastSearchKeyword) {
            debounceTimer = setTimeout(() => {
                lastSearchKeyword = keyword;
                ps.keywordSearch(keyword, (data, status) => {
                    if (status === kakao.maps.services.Status.OK && data.length > 0) {
                        const first = data[0];

                        // 🔥 검색 완료 플래그 설정 (자동 이동 방지)
                        window._searchJustCompleted = true;

                        // 검색 시 항상 레벨 4로 강제 설정 (force: true)
                        setMapCenterAndLevel(first.y, first.x, 4, true);
                        setLastSearchCenter({ lat: first.y, lng: first.x });

                        // 검색 키워드를 전역 변수로 저장 (자동 선택용)
                        window.lastSearchKeyword = keyword;

                        // 지도 이동 완료 후 주변 검색 실행 (넓은 범위로 충전소 표시)
                        setTimeout(() => {
                            if (updateStationsCallback) {
                                // bounds 기반 검색으로 화면에 보이는 모든 충전소 표시
                                updateStationsCallback({
                                    useBounds: true,
                                    skipAutoMove: true  // 자동 이동 방지
                                });
                            }
                            // 2초 후 검색 완료 플래그 해제
                            setTimeout(() => {
                                window._searchJustCompleted = false;
                            }, 2000);
                        }, 300);
                    }
                });
            }, 1500);
        }
    });

    // "현 지도에서 검색" 버튼
    if (searchBtn) {
        searchBtn.onclick = () => {
            const center = getMapCenter();
            clearLastSearchCenter();

            if (updateStationsCallback) {
                updateStationsCallback({
                    center: { lat: center.lat, lng: center.lng },
                    forceCenterSearch: true
                });
            }
        };
    }
}
