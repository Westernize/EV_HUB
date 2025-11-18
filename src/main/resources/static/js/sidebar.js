// 사이드바 관련 기능

// 즐겨찾기 관련 함수
function getFavoriteStations() {
    try {
        const favorites = localStorage.getItem('favoriteStations');
        return favorites ? JSON.parse(favorites) : [];
    } catch (e) {
        return [];
    }
}

function saveFavoriteStations(favorites) {
    try {
        localStorage.setItem('favoriteStations', JSON.stringify(favorites));
    } catch (e) {
        console.error('즐겨찾기 저장 실패:', e);
    }
}

function isStationFavorite(station) {
    const favorites = getFavoriteStations();
    const stationId = station.statId || station.id;
    return favorites.includes(stationId);
}

function toggleFavorite(event, stationId) {
    event.preventDefault();
    event.stopPropagation();

    const favorites = getFavoriteStations();
    const index = favorites.indexOf(stationId);

    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(stationId);
    }

    saveFavoriteStations(favorites);

    // 오버레이 다시 그리기 (즐겨찾기 상태 반영)
    if (window.currentSelectedStation) {
        showStationDetail(window.currentSelectedStation);
    }
}

// 전역 함수로 등록
window.toggleFavorite = toggleFavorite;

// 전역 변수: 현재 페이지와 페이지당 항목 수
window.currentPage = 1;
const itemsPerPage = 20;

// 사이드바에 충전소 목록 표시
function displaySidebarStations(stations) {
    const sidebar = document.getElementById('stationList');
    const pagination = document.getElementById('pagination');
    if (!sidebar) return;

    sidebar.innerHTML = "";

    if (stations.length === 0) {
        sidebar.innerHTML = "<div style='color:#999;padding:10px;'>검색 결과가 없습니다.</div>";
        if (pagination) pagination.style.display = 'none';
        return;
    }

    // 사이드바 제한 (성능 최적화)
    const maxSidebarItems = 200;
    let sidebarStations = stations.length > maxSidebarItems
        ? stations.slice(0, maxSidebarItems)
        : stations;

    // 검색 키워드 가져오기 (검색창 또는 전역 변수에서)
    const searchBox = document.getElementById('searchBox');
    const searchKeyword = (searchBox && searchBox.value.trim()) 
        ? searchBox.value.trim().toLowerCase() 
        : (window.lastSearchKeyword ? window.lastSearchKeyword.toLowerCase() : '');
    
    // 사용자 위치 기준으로 거리순 정렬 (키워드 일치 우선)
    const userLocation = getUserLocation();
    if (userLocation) {
        sidebarStations = sidebarStations.map(st => {
            const distance = getDistance(userLocation.lat, userLocation.lng, st.lat, st.lng);
            
            // 키워드 일치 점수 계산
            let keywordScore = 0;
            if (searchKeyword) {
                const name = (st.name || '').toLowerCase();
                const addr = (st.addr || '').toLowerCase();
                
                // 이름에 정확히 포함되면 높은 점수
                if (name.includes(searchKeyword)) {
                    keywordScore += 100;
                    // 이름 시작 부분에 포함되면 더 높은 점수
                    if (name.indexOf(searchKeyword) === 0) {
                        keywordScore += 50;
                    }
                }
                // 주소에 포함되면 낮은 점수
                if (addr.includes(searchKeyword)) {
                    keywordScore += 10;
                }
            }
            
            return { ...st, distance, keywordScore };
        }).sort((a, b) => {
            // 키워드 점수가 높은 것 우선
            if (b.keywordScore !== a.keywordScore) {
                return b.keywordScore - a.keywordScore;
            }
            // 키워드 점수가 같으면 거리순으로 정렬 (가까운 순)
            return (a.distance || Infinity) - (b.distance || Infinity);
        });
    }

    // 전체 페이지 수 계산
    const totalPages = Math.ceil(sidebarStations.length / itemsPerPage);
    window.currentPage = Math.min(window.currentPage, totalPages) || 1;

    // 현재 페이지에 표시할 항목들
    const startIndex = (window.currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentStations = sidebarStations.slice(startIndex, endIndex);

    // 검색 후 첫 번째 항목 자동 선택 비활성화
    const shouldAutoSelect = false; // 자동 선택 완전 차단
    let isFirstItem = true;
    
    // 완전 일치 여부 확인 함수 (정확히 일치하는 경우만)
    const isExactMatch = (station, keyword) => {
        if (!keyword) return false;
        const name = (station.name || '').toLowerCase();
        const keywordLower = keyword.toLowerCase();
        
        // 정확히 일치하는 경우만 (포함이 아닌 완전 일치)
        return name === keywordLower;
    };
    
    // 상태 아이콘 생성 함수 (forEach 밖으로 이동)
    function createStatusIcons(station, activeReservations = []) {
        if (!station.realtime || !Array.isArray(station.realtime)) {
            return ['<span style="color:#999;">실시간 정보 없음</span>'];
        }

        let total = station.realtime.length;
        let available = 0;
        let charging = 0;
        let checking = 0;

        station.realtime.forEach(r => {
            let status = r.status || "정보없음";
            const chargerId = r.chgerId;

            const isReserved = activeReservations.some(ar =>
                String(ar.chargerId) === String(chargerId)
            );

            if (isReserved) {
                charging++;
                return;
            }

            if (status.includes("충전가능") || status.includes("정보없음")) available++;
            else if (status.includes("충전중")) charging++;
            else if (status.includes("점검중")) checking++;
        });

        let arr = [];
        if (available > 0)
            arr.push(`<span style="color:#00e676;font-weight:600;"><img src="${getImagePath('g.png')}" style="width:14px;height:14px;margin-right:2px;"> ${available}대 충전가능</span>`);
        if (charging > 0)
            arr.push(`<span style="color:#ff5252;font-weight:600;"><img src="${getImagePath('r.png')}" style="width:14px;height:14px;margin-right:2px;"> ${charging}대 충전중</span>`);
        if (checking > 0)
            arr.push(`<span style="color:#ff9800;font-weight:600;"><img src="${getImagePath('o.png')}" style="width:14px;height:14px;margin-right:2px;"> ${checking}대 점검중</span>`);
        if (arr.length === 0)
            arr.push(`<span style="color:#999;">정보없음</span>`);

        return arr;
    }
    
    // 예약 정보 가져오기 (비동기)
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
            
            // 디버깅: 모든 예약 정보 출력
            console.log('📋 전체 예약 목록:', reservations);
            
            if (reservations && Array.isArray(reservations)) {
                reservations.forEach(reservation => {
                    // 디버깅: 각 예약 정보 출력
                    console.log('예약 정보:', {
                        placeName: reservation.placeName,
                        chgerId: reservation.chgerId,
                        chargerId: reservation.chargerId,
                        reserveDate: reservation.reserveDate,
                        reserveTime: reservation.reserveTime
                    });
                    if (reservation.reserveDate && reservation.reserveTime) {
                        try {
                            // reserveTime이 "HH:mm" 형식이면 "HH:mm:00"으로 변환
                            let timeStr = reservation.reserveTime;
                            if (timeStr && timeStr.length === 5 && timeStr.match(/^\d{2}:\d{2}$/)) {
                                timeStr = timeStr + ':00';
                            }
                            
                            // 날짜와 시간을 분리해서 로컬 시간대로 파싱
                            const [year, month, day] = reservation.reserveDate.split('-').map(Number);
                            const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
                            
                            // 로컬 시간대로 명시적으로 생성 (월은 0부터 시작하므로 -1)
                            const reserveDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
                            const reserveEndTime = new Date(reserveDateTime);
                            // 예약 시간 + 1시간 (기본값, duration 정보가 없으므로)
                            // TODO: 백엔드에 duration 정보가 추가되면 reservation.duration 사용
                            const durationMinutes = reservation.duration || 60; // 기본값 60분
                            reserveEndTime.setMinutes(reserveEndTime.getMinutes() + durationMinutes);
                            
                            // 현재 시간이 예약 시간 범위 안에 있는지 확인
                            if (now >= reserveDateTime && now < reserveEndTime) {
                                activeReservations.push({
                                    chargerId: reservation.chgerId || reservation.chargerId,
                                    placeName: reservation.placeName,
                                    reserveDateTime: reserveDateTime,
                                    reserveEndTime: reserveEndTime
                                });
                                
                                // 디버깅: 활성화된 예약 정보 출력
                                console.log('활성화된 예약 추가:', {
                                    placeName: reservation.placeName,
                                    chargerId: reservation.chgerId || reservation.chargerId,
                                    reserveDateTime: reserveDateTime.toLocaleString(),
                                    reserveEndTime: reserveEndTime.toLocaleString(),
                                    now: now.toLocaleString()
                                });
                            }
                        } catch (e) {
                            console.warn('예약 시간 파싱 오류:', e);
                        }
                    }
                });
            }
            
            // 전역 예약 정보 저장 (마커 색상 결정에 사용)
            window.activeReservations = activeReservations;
            
            // 🔥 마커 상태 즉시 업데이트 (예약 정보 반영)
            if (typeof window.updateMarkerStates === 'function') {
                window.updateMarkerStates();
            }
            
            // 디버깅: 예약 정보 확인
            if (activeReservations.length > 0) {
                console.log('활성화된 예약:', activeReservations);
            }
            
            // 현재 페이지의 항목만 표시
            currentStations.forEach((st, index) => {
                const div = document.createElement("div");
                div.className = "station";
                div.style.display = "flex";
                div.style.gap = "12px";
                div.style.padding = "16px";
                div.style.marginBottom = "12px";
                
                // 검색 후 첫 번째 항목 자동 선택 및 강조 (완전 일치하는 경우에만 상세정보 표시)
                if (shouldAutoSelect && isFirstItem && index === 0) {
                    const exactMatch = isExactMatch(st, searchKeyword);
                    
                    if (exactMatch) {
                        div.classList.add("selected");
                        isFirstItem = false;
                        
                        // 약간의 지연 후 자동 선택 (마커가 지도에 표시된 후)
                        setTimeout(() => {
                            // 지도 중심 이동 및 확대
                            if (typeof setMapCenterAndLevel === 'function') {
                                setMapCenterAndLevel(st.lat, st.lng, 2, true); // force: true로 강제 확대
                            }

                            
                            // 마커가 표시될 때까지 대기 후 강조
                            setTimeout(() => {
                                // 해당 마커 강조
                                if (typeof highlightMarkerByStation === 'function') {
                                    highlightMarkerByStation(st);
                                }
                                
                                // 사이드바에 상세 정보 표시 (완전 일치하는 경우에만)
                                showSidebarDetail(st);
                            }, 300);
                        }, 800);
                    } else {
                        // 완전 일치하지 않으면 목록만 표시 (선택 스타일만 적용)
                        div.classList.add("selected");
                        isFirstItem = false;
                        
                        setTimeout(() => {
                            // 지도 중심 이동 및 확대
                            if (typeof setMapCenterAndLevel === 'function') {
                                setMapCenterAndLevel(st.lat, st.lng, 2, true); // force: true로 강제 확대
                            }
                            
                            // 마커 강조만 (상세정보는 표시하지 않음)
                            setTimeout(() => {
                                if (typeof highlightMarkerByStation === 'function') {
                                    highlightMarkerByStation(st);
                                }
                            }, 300);
                        }, 800);
                    }
                }

                // 🔥 상태 아이콘 생성 (함수 호출)
                const statusIcons = createStatusIcons(st, activeReservations);

        // 거리 계산 (이미 정렬 시 계산된 거리 사용)
        let distanceText = '';
        if (userLocation) {
            const distance = st.distance || getDistance(userLocation.lat, userLocation.lng, st.lat, st.lng);
            let distanceDisplay = '';
            if (distance < 1) {
                // 1km 미만: 미터로 표시 (100m 단위로 반올림)
                const meters = distance * 1000;
                distanceDisplay = Math.round(meters / 100) * 100 + 'm';
            } else {
                // 1km 이상: 킬로미터로 표시 (반올림)
                distanceDisplay = Math.round(distance) + 'km';
            }
            distanceText = `<div style="font-size:12px;color:rgba(100, 200, 255, 0.95);margin-top:4px;font-weight:500;display:flex;align-items:center;gap:4px;"><img src="/img/location.png" style="width:12px;height:12px;object-fit:contain;" alt="위치" /> 내 위치로부터 ${distanceDisplay}</div>`;
        }

        // 콘텐츠
        const contentDiv = document.createElement("div");
        contentDiv.style.flex = "1";
        contentDiv.style.minWidth = "0";
        contentDiv.innerHTML = `<strong style="display:block;font-size:16px;color:#ffffff;margin-bottom:8px;font-weight:600;">${st.name}</strong>
      <div style="font-size:13px;color:rgba(100, 200, 255, 0.95);margin-bottom:10px;line-height:1.5;">${st.addr}</div>
      <div style="margin-top:8px;font-size:13px;font-weight:600;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        ${statusIcons.join(" | ")}
      </div>
      <div style="font-size:12px;color:rgba(100, 200, 255, 0.95);margin-top:10px;padding-top:0;border-top:none;">
        ${st.chargerType || '정보없음'} | ${st.operator || '미등록'}
      </div>
      ${distanceText}`;

        div.appendChild(contentDiv);

        const pos = new kakao.maps.LatLng(st.lat, st.lng);
        div.onclick = () => {
            // 모든 선택 해제
            document.querySelectorAll('.station.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 현재 항목 선택
            div.classList.add('selected');
            
            // 🔥 사이드바 선택 플래그 설정 (오버레이 닫기 방지)
            window._sidebarSelection = true;
            
            // 🔥 확대 방해 요소 제거
            window._ignoreIdle = true;
            setTimeout(() => {
                window._ignoreIdle = false;
            }, 300);
            
            // 🔥 zoom_changed 이벤트 무시 (사이드바 클릭으로 강제 확대 시)
            window._lockZoomChange = true;
            
            // 🔥 zoom_changed의 forceCloseByLevel 비활성화 (사이드바 클릭 시 확대 방해 방지)
            window._blockZoomForce = true;
            
            // 🔥 확대하는 동안 updateStationsOnMapChange 일시 정지 (마커 리셋 방지)
            window._blockMapUpdate = true;
            
            // 지도 중심 이동 및 확대 (레벨 2로 설정, 강제 확대)
            setMapCenterAndLevel(st.lat, st.lng, 2, true);
            
            // 500ms 후 플래그 해제
            setTimeout(() => {
                window._lockZoomChange = false;
                window._blockZoomForce = false;
                window._blockMapUpdate = false;
            }, 500);
            
            // 사이드바 상세정보 표시 (내부에서 overlayOpenedAt 갱신)
            showSidebarDetail(st);
            
            // 마커 강조 (확대 완료 후 실행하여 확대 상태 유지)
            setTimeout(() => {
                if (typeof highlightMarkerByStation === 'function') {
                    highlightMarkerByStation(st);
                }
            }, 100);
            
            // 800ms 후 플래그 해제
            setTimeout(() => {
                window._sidebarSelection = false;
            }, 800);
        };

        sidebar.appendChild(div);
            });
        })
        .catch(err => {
            console.error('예약 목록 로드 오류:', err);
            // 예약 정보 없이 기본 표시
            currentStations.forEach((st, index) => {
                const div = document.createElement("div");
                div.className = "station";
                div.style.display = "flex";
                div.style.gap = "12px";
                div.style.padding = "16px";
                div.style.marginBottom = "12px";
                
                const statusIcons = createStatusIcons(st, []);
                
                // 거리 계산
                let distanceText = '';
                if (userLocation) {
                    const distance = st.distance || getDistance(userLocation.lat, userLocation.lng, st.lat, st.lng);
                    let distanceDisplay = '';
                    if (distance < 1) {
                        const meters = distance * 1000;
                        distanceDisplay = Math.round(meters / 100) * 100 + 'm';
                    } else {
                        distanceDisplay = Math.round(distance) + 'km';
                    }
                    distanceText = `<div style="font-size:12px;color:rgba(100, 200, 255, 0.95);margin-top:4px;font-weight:500;display:flex;align-items:center;gap:4px;"><img src="/img/location.png" style="width:12px;height:12px;object-fit:contain;" alt="위치" /> 내 위치로부터 ${distanceDisplay}</div>`;
                }
                
                const contentDiv = document.createElement("div");
                contentDiv.style.flex = "1";
                contentDiv.style.minWidth = "0";
                contentDiv.innerHTML = `<strong style="display:block;font-size:16px;color:#ffffff;margin-bottom:8px;font-weight:600;">${st.name}</strong>
      <div style="font-size:13px;color:rgba(100, 200, 255, 0.95);margin-bottom:10px;line-height:1.5;">${st.addr}</div>
      <div style="margin-top:8px;font-size:13px;font-weight:600;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        ${statusIcons.join(" | ")}
      </div>
      <div style="font-size:12px;color:rgba(100, 200, 255, 0.95);margin-top:10px;padding-top:0;border-top:none;">
        ${st.chargerType || '정보없음'} | ${st.operator || '미등록'}
      </div>
      ${distanceText}`;
                
                div.appendChild(contentDiv);
                
                div.onclick = () => {
                    document.querySelectorAll('.station.selected').forEach(el => el.classList.remove('selected'));
                    div.classList.add('selected');
                    setMapCenterAndLevel(st.lat, st.lng, 2);
                    if (typeof highlightMarkerByStation === 'function') {
                        highlightMarkerByStation(st);
                    }
                    showSidebarDetail(st);
                };
                
                sidebar.appendChild(div);
            });
        });

    // 페이지네이션 버튼 생성
    if (pagination && totalPages > 1) {
        pagination.innerHTML = "";
        pagination.style.display = "flex";

        // 이전 버튼
        const prevBtn = document.createElement("button");
        prevBtn.textContent = "<";
        prevBtn.className = "page-btn";
        prevBtn.onclick = () => {
            if (window.currentPage > 1) {
                window.currentPage--;
                displaySidebarStations(sidebarStations);
                const sidebarContent = document.getElementById('sidebar-content');
                if (sidebarContent) {
                    sidebarContent.scrollTop = 0;
                }
            }
        };
        pagination.appendChild(prevBtn);

        // 최대 5개 페이지 버튼 표시
        let startPage = Math.max(1, window.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        // 끝에서 5개가 안 되면 시작점 조정
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement("button");
            pageBtn.textContent = i;
            pageBtn.className = "page-btn";
            if (i === window.currentPage) {
                pageBtn.classList.add("active");
            }
            pageBtn.onclick = () => {
                window.currentPage = i;
                displaySidebarStations(sidebarStations);
                const sidebarContent = document.getElementById('sidebar-content');
                if (sidebarContent) {
                    sidebarContent.scrollTop = 0;
                }
            };
            pagination.appendChild(pageBtn);
        }

        // 다음 버튼
        const nextBtn = document.createElement("button");
        nextBtn.textContent = ">";
        nextBtn.className = "page-btn";
        nextBtn.onclick = () => {
            if (window.currentPage < totalPages) {
                window.currentPage++;
                displaySidebarStations(sidebarStations);
                const sidebarContent = document.getElementById('sidebar-content');
                if (sidebarContent) {
                    sidebarContent.scrollTop = 0;
                }
            }
        };
        pagination.appendChild(nextBtn);
    } else if (pagination) {
        pagination.style.display = "none";
    }

    // 전체 목록 저장 (페이지네이션용)
    window.currentStationsList = sidebarStations;
    
    // 사이드바 리스트 자동 갱신 interval 설정
    // 기존 interval이 있으면 정리
    if (window.sidebarListUpdateInterval) {
        clearInterval(window.sidebarListUpdateInterval);
        window.sidebarListUpdateInterval = null;
    }
    
    // 30초마다 사이드바 리스트 갱신 (상세정보가 열려있지 않을 때만)
    window.sidebarListUpdateInterval = setInterval(() => {
        const sidebarDetail = document.getElementById('sidebar-detail');
        const isDetailOpen = sidebarDetail && !sidebarDetail.classList.contains('hidden');
        
        // 상세정보가 열려있지 않을 때만 리스트 갱신
        if (!isDetailOpen) {
            // 현재 표시 중인 stations가 있으면 다시 표시
            if (window.currentStationsList && window.currentStationsList.length > 0) {
                displaySidebarStations(window.currentStationsList);
            } else if (window.currentStations && window.currentStations.length > 0) {
                // currentStations가 있으면 그것을 사용
                displaySidebarStations(window.currentStations);
            } else if (typeof window.updateStations === 'function') {
                // updateStations 함수가 있으면 전체 갱신
                window.updateStations();
            }
        }
    }, 30000); // 30초마다 업데이트
}

// 페이지로 스크롤 이동
function scrollToPage(container, pageNumber) {
    const targetElement = container.querySelector(`[data-page="${pageNumber}"]`);
    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // 페이지네이션 버튼 업데이트
        updatePaginationButtons();
    }
}

// 페이지네이션 버튼 업데이트
function updatePaginationButtons() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    const buttons = pagination.querySelectorAll('.page-btn');
    buttons.forEach(btn => {
        if (btn.textContent === String(window.currentPage)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 사이드바 상세정보 표시
function showSidebarDetail(station) {
    console.log('=== showSidebarDetail 함수 호출 시작 ===');
    console.log('충전소 정보:', station);
    
    // 🔥 overlayOpenedAt 갱신 (forceCloseByLevel에서 확대 방해 방지)
    window.overlayOpenedAt = Date.now();

    // 현재 활성화된 섹션 확인 - 목록 섹션이 활성화되어 있거나, 로그인 상태에서 내 예약/즐겨찾기/쿠폰 섹션이 활성화되어 있을 때 상세정보 표시
    const stationsSection = document.getElementById('stations-section');
    const reservationsSection = document.getElementById('reservations-section');
    const favoritesSection = document.getElementById('favorites-section');
    const couponsSection = document.getElementById('coupons-section');
    
    const isStationsSectionActive = stationsSection && !stationsSection.classList.contains('hidden');
    const isReservationsSectionActive = reservationsSection && !reservationsSection.classList.contains('hidden');
    const isFavoritesSectionActive = favoritesSection && !favoritesSection.classList.contains('hidden');
    const isCouponsSectionActive = couponsSection && !couponsSection.classList.contains('hidden');
    
    // 로그인 상태 확인
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const isLoggedIn = currentUser && currentUser.id;
    
    // 목록 섹션이 활성화되어 있거나, 로그인 상태에서 내 예약/즐겨찾기/쿠폰 섹션이 활성화되어 있을 때만 표시
    const shouldShowDetail = isStationsSectionActive || 
        (isLoggedIn && (isReservationsSectionActive || isFavoritesSectionActive || isCouponsSectionActive));
    
    if (!shouldShowDetail) {
        console.log('⚠️ 상세정보를 표시할 수 있는 섹션이 활성화되어 있지 않습니다.');
        return;
    }

    const sidebarDetail = document.getElementById('sidebar-detail');
    const sidebarDetailName = document.getElementById('sidebar-detail-name');
    const sidebarDetailAddr = document.getElementById('sidebar-detail-addr');
    const sidebarDetailLoc = document.getElementById('sidebar-detail-loc');
    const sidebarDetailOperator = document.getElementById('sidebar-detail-operator');
    // 테이블 대신 카드 컨테이너 사용
    const sidebarDetailClose = document.getElementById('sidebar-detail-close');

    if (!sidebarDetail) {
        console.error('❌ sidebar-detail 요소를 찾을 수 없습니다!');
        alert('사이드바 상세 정보 영역을 찾을 수 없습니다.');
        return;
    }
    console.log('✅ sidebar-detail 요소 찾음');

    // 리스트, 헤더 숨기고 상세정보 표시
    const stationList = document.getElementById('stationList');
    const sidebarTitle = document.querySelector('#sidebar-content > h3');
    const pagination = document.getElementById('pagination');
    
    // 로그인 상태에서 내 예약/즐겨찾기/쿠폰 섹션의 리스트도 숨기기
    const reservationsList = document.getElementById('reservations-list');
    const favoritesList = document.getElementById('favorites-list');
    const couponsList = document.getElementById('coupons-list');

    console.log('요소 확인:', {
        stationList: !!stationList,
        sidebarTitle: !!sidebarTitle,
        sidebarDetail: !!sidebarDetail,
        pagination: !!pagination,
        reservationsList: !!reservationsList,
        favoritesList: !!favoritesList,
        couponsList: !!couponsList
    });

    // 리스트, 헤더 숨기고 상세정보 표시
    if (stationList) {
        stationList.classList.add('hidden');
        stationList.style.display = 'none'; // 강제로 숨김
        console.log('✅ 목록 숨김 완료');
    } else {
        console.error('❌ stationList를 찾을 수 없습니다!');
    }
    
    // 로그인 상태에서 내 예약/즐겨찾기/쿠폰 섹션의 리스트 숨기기
    if (isLoggedIn) {
        if (isReservationsSectionActive && reservationsList) {
            reservationsList.style.display = 'none';
            console.log('✅ 예약 목록 숨김 완료');
        }
        if (isFavoritesSectionActive && favoritesList) {
            favoritesList.style.display = 'none';
            console.log('✅ 즐겨찾기 목록 숨김 완료');
        }
        if (isCouponsSectionActive && couponsList) {
            couponsList.style.display = 'none';
            console.log('✅ 쿠폰 목록 숨김 완료');
        }
        
        // 해당 섹션의 헤더(h3)도 숨기기
        if (isReservationsSectionActive || isFavoritesSectionActive || isCouponsSectionActive) {
            const activeSection = isReservationsSectionActive ? reservationsSection :
                                 isFavoritesSectionActive ? favoritesSection :
                                 isCouponsSectionActive ? couponsSection : null;
            if (activeSection) {
                const sectionTitle = activeSection.querySelector('h3');
                if (sectionTitle) {
                    sectionTitle.style.display = 'none';
                    console.log('✅ 섹션 제목 숨김 완료');
                }
            }
        }
    }

    // 페이지네이션 삭제 (상세정보 표시 시)
    if (pagination) {
        pagination.remove();
        console.log('✅ 페이지네이션 삭제 완료');
    }

    if (sidebarTitle) {
        sidebarTitle.classList.add('hidden');
        sidebarTitle.style.display = 'none'; // 강제로 숨김
        console.log('✅ 제목 숨김 완료');
    } else {
        console.error('❌ sidebarTitle을 찾을 수 없습니다!');
    }
    
    // 상세정보 표시 시 로그아웃 상태일 때만 로그인 프롬프트 섹션 숨기기
    // 로그인 상태일 때는 사용자 정보 섹션 유지
    if (!isLoggedIn) {
        const loginPromptSection = document.getElementById('login-prompt-section');
        if (loginPromptSection) {
            loginPromptSection.classList.add('hidden');
            loginPromptSection.style.display = 'none';
            console.log('✅ 로그인 프롬프트 섹션 숨김 완료 (로그아웃 상태)');
        }
    }

    if (sidebarDetail) {
        sidebarDetail.classList.remove('hidden');
        sidebarDetail.style.display = 'block';
        sidebarDetail.style.visibility = 'visible';
        console.log('✅ 상세정보 표시 완료');

        // 사이드바 스크롤을 맨 위로 이동
        const sidebarContent = document.getElementById('sidebar-content');
        if (sidebarContent) {
            sidebarContent.scrollTop = 0;
            console.log('✅ 스크롤 맨 위로 이동');
        }
    } else {
        console.error('❌ sidebarDetail을 찾을 수 없습니다!');
    }

    console.log('=== 사이드바 전환 완료 ===');

    // 현재 선택된 충전소 저장 (예약 완료 후 갱신용)
    window.currentSelectedStation = station;

    sidebarDetailName.textContent = station.name;
    sidebarDetailAddr.textContent = station.addr;
    sidebarDetailLoc.textContent = station.addr;
    sidebarDetailOperator.textContent = station.operator || '미등록';
    
    // 현재 시간 표시 및 업데이트 (실시간)
    const updateCurrentTime = () => {
        const timeElement = document.getElementById('sidebar-detail-time');
        if (timeElement) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            timeElement.textContent = `${hours}:${minutes}`;
        }
    };
    updateCurrentTime();
    // 1초마다 시간 업데이트 (실시간)
    const timeInterval = setInterval(updateCurrentTime, 1000);
    // 사이드바가 닫힐 때 interval 정리
    if (window.sidebarDetailTimeInterval) {
        clearInterval(window.sidebarDetailTimeInterval);
    }
    window.sidebarDetailTimeInterval = timeInterval;

    // 시간별 사용량 차트 생성
    const hourlyUsageChart = document.getElementById('hourly-usage-chart');
    const weekdayButtons = document.querySelectorAll('.weekday-btn');

    if (hourlyUsageChart) {
        // 오늘 요일로 초기화
        const today = new Date();
        const currentDay = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일

        // 모든 버튼에서 active 클래스 먼저 제거 (중복 선택 방지)
        weekdayButtons.forEach(btn => {
            btn.classList.remove('active');
        });

        // 기존 이벤트 리스너 제거 (중복 방지)
        weekdayButtons.forEach(btn => {
            // 기존 클릭 이벤트 제거를 위해 클론 후 교체
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });

        // 새로운 버튼들 다시 선택
        const newWeekdayButtons = document.querySelectorAll('.weekday-btn');

        // 요일 버튼 클릭 이벤트 (한 번만 등록)
        newWeekdayButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                // 모든 버튼에서 active 클래스 제거 (명시적으로)
                document.querySelectorAll('.weekday-btn').forEach(b => {
                    b.classList.remove('active');
                });
                // 클릭한 버튼에만 active 클래스 추가
                btn.classList.add('active');

                // 선택한 요일의 날짜 계산
                const selectedDay = parseInt(btn.getAttribute('data-day'));
                const selectedDate = getDateForWeekday(selectedDay);
                generateHourlyUsageChart(hourlyUsageChart, station, selectedDate);
            });

            // 현재 요일 버튼만 활성화
            if (parseInt(btn.getAttribute('data-day')) === currentDay) {
                btn.classList.add('active');
            }
        });

        // 초기 차트 생성 (오늘 날짜)
        const todayDate = today.toISOString().split('T')[0];
        generateHourlyUsageChart(hourlyUsageChart, station, todayDate);
    }

    // 카드 컨테이너 찾기
    const chargerCardsContainer = document.getElementById('charger-cards-container');
    const chargerAvailability = document.getElementById('charger-availability');

    if (station.realtime && Array.isArray(station.realtime)) {
        if (chargerCardsContainer) {
            // 예약 목록 가져오기 (비동기)
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
                    // 예약된 충전기 ID 목록 생성 및 예약 시간 확인
                    const activeReservations = []; // 현재 시간대에 활성화된 예약 목록
                    const now = new Date();
                    
                    if (reservations && Array.isArray(reservations)) {
                        reservations.forEach(reservation => {
                            // 예약 시간 확인 (현재 시간대에 예약이 활성화되어 있는지)
                            if (reservation.reserveDate && reservation.reserveTime) {
                                try {
                                    // reserveTime이 "HH:mm" 형식이면 "HH:mm:00"으로 변환
                                    let timeStr = reservation.reserveTime;
                                    if (timeStr && timeStr.length === 5 && timeStr.match(/^\d{2}:\d{2}$/)) {
                                        timeStr = timeStr + ':00';
                                    }
                                    
                                    // 날짜와 시간을 분리해서 로컬 시간대로 파싱
                                    const [year, month, day] = reservation.reserveDate.split('-').map(Number);
                                    const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
                                    
                                    // 로컬 시간대로 명시적으로 생성 (월은 0부터 시작하므로 -1)
                                    const reserveDateTime = new Date(year, month - 1, day, hours, minutes, seconds);
                                    const reserveEndTime = new Date(reserveDateTime);
                                    // 예약 시간 + duration (기본값 60분)
                                    const durationMinutes = reservation.duration || 60;
                                    reserveEndTime.setMinutes(reserveEndTime.getMinutes() + durationMinutes);
                                    
                                    // 현재 시간이 예약 시간대 안에 있는지 확인
                                    if (now >= reserveDateTime && now < reserveEndTime) {
                                        activeReservations.push({
                                            chargerId: reservation.chgerId || reservation.chargerId,
                                            placeName: reservation.placeName,
                                            reserveDateTime: reserveDateTime,
                                            reserveEndTime: reserveEndTime
                                        });
                                    }
                                } catch (e) {
                                    console.warn('예약 시간 파싱 오류:', e, reservation);
                                }
                            }
                        });
                    }
                    
                    // 전역 예약 정보 저장 (마커 색상 결정에 사용)
                    window.activeReservations = activeReservations;

                    // 충전기 개수 및 사용 가능 개수 계산 (예약 시간대 고려)
                    let totalChargers = station.realtime ? station.realtime.length : 0;
                    let availableChargers = 0;
                    let chargingChargers = 0; // 예약 시간대에 있는 충전기 수

                    chargerCardsContainer.innerHTML = station.realtime.map((r, index) => {
                        let statusText = r.status || "정보없음";
                        let statusBadgeColor = "#e0e0e0";
                        let statusBadgeTextColor = "#666";
                        let cardBgColor = "#fff";
                        let isAvailable = false;

                        const speed = r.speed || '-';
                        const chargerType = r.chargerType || '-';
                        const chargerId = r.chgerId || index.toString();

                        // 예약 여부 확인
                        // 예약된 시간대가 되면 예약불가로 변경
                        const isActiveReservation = activeReservations.some(ar =>
                            String(ar.chargerId) === String(chargerId)
                        );
                        
                        if (isActiveReservation && (statusText.includes("충전가능") || statusText.includes("정보없음"))) {
                            statusText = "예약불가";
                            statusBadgeColor = "#ffebee";
                            statusBadgeTextColor = "#c62828";
                            cardBgColor = "#fff5f5";
                            isAvailable = false;
                            chargingChargers++; // 예약 시간대에 있는 충전기 카운트
                        }
                        else if (statusText.includes("충전가능")) {
                            statusBadgeColor = "#e8f5e9";
                            statusBadgeTextColor = "#2e7d32";
                            cardBgColor = "#f1f8f4";
                            isAvailable = true;
                            availableChargers++; // 사용 가능한 충전기 카운트
                        }
                        else if (statusText.includes("충전중")) {
                            statusBadgeColor = "#ffebee";
                            statusBadgeTextColor = "#c62828";
                            cardBgColor = "#fff5f5";
                        }
                        else if (statusText.includes("점검중")) {
                            statusBadgeColor = "#fff3e0";
                            statusBadgeTextColor = "#e65100";
                            cardBgColor = "#fffbf0";
                        }
                        else if (statusText.includes("정보없음")) {
                            // 예약 시간대가 아니면 충전가능으로 표시
                            if (!isActiveReservation) {
                                statusText = "충전가능 (추정)";
                                statusBadgeColor = "#e8f5e9";
                                statusBadgeTextColor = "#2e7d32";
                                cardBgColor = "#f1f8f4";
                                isAvailable = true;
                                availableChargers++; // 사용 가능한 충전기 카운트
                            } else {
                                // 예약 시간대면 예약불가로 표시
                                statusText = "예약불가";
                                statusBadgeColor = "#ffebee";
                                statusBadgeTextColor = "#c62828";
                                cardBgColor = "#fff5f5";
                                isAvailable = false;
                                chargingChargers++; // 예약 시간대에 있는 충전기 카운트
                            }
                        }

                        // kW 정보 추출 또는 추론
                        let kwInfo = '';

                        // chargerType에서 kW 정보 추출 시도
                        const kwMatch = chargerType.match(/(\d+(?:\.\d+)?)\s*kW/i) || chargerType.match(/(\d+(?:\.\d+)?)kW/i);

                        if (kwMatch) {
                            // 데이터에 kW 정보가 있으면 사용
                            kwInfo = ` (${kwMatch[1]}KW)`;
                        } else {
                            // kW 정보가 없으면 speed와 chargerType을 기반으로 추론
                            if (speed.includes('완속')) {
                                // 완속 충전기는 보통 7kW (AC 완속) 또는 3.3kW
                                if (chargerType.includes('AC3상') || chargerType.includes('AC완속')) {
                                    kwInfo = ' (7KW)';
                                } else {
                                    kwInfo = ' (7KW)'; // 기본값
                                }
                            } else if (speed.includes('급속')) {
                                // 급속 충전기는 보통 50kW, 100kW, 150kW, 200kW, 350kW 등
                                if (chargerType.includes('DC콤보') || chargerType.includes('DC차데모')) {
                                    // 일반적인 급속 충전기는 50kW 또는 100kW
                                    kwInfo = ' (50KW)';
                                } else {
                                    kwInfo = ' (50KW)'; // 기본값
                                }
                            }
                        }

                        // 충전기 타입 표시: speed에 kW 정보 추가, chargerType은 그대로
                        const speedWithKw = speed + kwInfo;
                        const chargerDetail = chargerType;

                        // 예약 버튼 생성 (예약 시간대가 활성화된 경우에만 예약 불가)
                        let reserveBtn;
                        if (isActiveReservation) {
                            // 예약 시간대가 활성화된 경우 예약 불가
                            reserveBtn = `<div class="charger-card-reserve-disabled">예약불가</div>`;
                        } else if (!isAvailable) {
                            // 예약 시간대가 아니지만 사용 불가능한 경우
                            reserveBtn = `<div class="charger-card-reserve-disabled">예약 불가</div>`;
                        } else {
                            // 예약 시간대가 아니고 사용 가능한 경우
                            reserveBtn = `<button class="charger-card-reserve-btn" onclick="handleReserve('${chargerId}', '${station.name}')">예약하기</button>`;
                        }

                        return `
                  <div class="charger-card" style="background:${cardBgColor};">
                    <div class="charger-card-status-badge" style="background:${statusBadgeColor}; color:${statusBadgeTextColor};">
                      ${statusText}
                    </div>
                    <div class="charger-card-content">
                      <div class="charger-card-type">${speedWithKw}</div>
                      <div class="charger-card-detail">${chargerDetail}</div>
                      <div class="charger-card-id">ID: ${chargerId}</div>
                    </div>
                    <div class="charger-card-footer">
                      ${reserveBtn}
                    </div>
                  </div>
                `;
                    }).join('');
                    
                    // 충전기 사용 가능 정보 업데이트 (예약 시간대 고려)
                    if (chargerAvailability) {
                        if (chargingChargers > 0) {
                            // 예약 시간대에 있는 충전기가 있으면 "충전중"으로 표시
                            chargerAvailability.textContent = `${totalChargers}대 중 ${availableChargers}대 충전중`;
                        } else {
                            chargerAvailability.textContent = `${totalChargers}대 중 ${availableChargers}대 사용가능`;
                        }
                    }
                })
                .catch(err => {
                    console.error('예약 목록 로드 오류:', err);
                    // 예약 목록 로드 실패 시 예약 확인 없이 기본 버튼 표시
                    chargerCardsContainer.innerHTML = station.realtime.map((r, index) => {
                        let statusText = r.status || "정보없음";
                        let statusBadgeColor = "#e0e0e0";
                        let statusBadgeTextColor = "#666";
                        let cardBgColor = "#fff";
                        let isAvailable = false;

                        if (statusText.includes("충전가능")) {
                            statusBadgeColor = "#e8f5e9";
                            statusBadgeTextColor = "#2e7d32";
                            cardBgColor = "#f1f8f4";
                            isAvailable = true;
                        }
                        else if (statusText.includes("충전중")) {
                            statusBadgeColor = "#ffebee";
                            statusBadgeTextColor = "#c62828";
                            cardBgColor = "#fff5f5";
                        }
                        else if (statusText.includes("점검중")) {
                            statusBadgeColor = "#fff3e0";
                            statusBadgeTextColor = "#e65100";
                            cardBgColor = "#fffbf0";
                        }
                        else if (statusText.includes("정보없음")) {
                            statusText = "충전가능 (추정)";
                            statusBadgeColor = "#e8f5e9";
                            statusBadgeTextColor = "#2e7d32";
                            cardBgColor = "#f1f8f4";
                            isAvailable = true;
                        }

                        const speed = r.speed || '-';
                        const chargerType = r.chargerType || '-';
                        const chargerId = r.chgerId || index.toString();

                        // kW 정보 추출 또는 추론
                        let kwInfo = '';
                        const kwMatch = chargerType.match(/(\d+(?:\.\d+)?)\s*kW/i) || chargerType.match(/(\d+(?:\.\d+)?)kW/i);
                        if (kwMatch) {
                            kwInfo = ` (${kwMatch[1]}KW)`;
                        } else {
                            if (speed.includes('완속')) {
                                kwInfo = ' (7KW)';
                            } else if (speed.includes('급속')) {
                                kwInfo = ' (50KW)';
                            }
                        }

                        const speedWithKw = speed + kwInfo;
                        const chargerDetail = chargerType;

                        const reserveBtn = isAvailable
                            ? `<button class="charger-card-reserve-btn" onclick="handleReserve('${chargerId}', '${station.name}')">예약하기</button>`
                            : `<div class="charger-card-reserve-disabled">예약 불가</div>`;

                        return `
                  <div class="charger-card" style="background:${cardBgColor};">
                    <div class="charger-card-status-badge" style="background:${statusBadgeColor}; color:${statusBadgeTextColor};">
                      ${statusText}
                    </div>
                    <div class="charger-card-content">
                      <div class="charger-card-type">${speedWithKw}</div>
                      <div class="charger-card-detail">${chargerDetail}</div>
                      <div class="charger-card-id">ID: ${chargerId}</div>
                    </div>
                    <div class="charger-card-footer">
                      ${reserveBtn}
                    </div>
                  </div>
                `;
                    }).join('');
                });
        }
    } else {
        if (chargerCardsContainer) {
            chargerCardsContainer.innerHTML = `<div style="color:#999; padding:20px; text-align:center;">실시간 정보 없음</div>`;
        }
    }

    // 닫기 버튼 이벤트 - 목록 화면으로 돌아가기
    const handleClose = () => {
        console.log('=== 사이드바 닫기 버튼 클릭 ===');

        // 실시간 업데이트 interval 정리
        if (window.sidebarDetailUpdateInterval) {
            clearInterval(window.sidebarDetailUpdateInterval);
            window.sidebarDetailUpdateInterval = null;
        }
        
        // 시간 업데이트 interval 정리
        if (window.sidebarDetailTimeInterval) {
            clearInterval(window.sidebarDetailTimeInterval);
            window.sidebarDetailTimeInterval = null;
        }

        // 상세정보 숨기기
        if (sidebarDetail) {
            sidebarDetail.classList.add('hidden');
            sidebarDetail.style.display = 'none';
            console.log('✅ 상세정보 숨김');
        }

        // 목록, 제목 다시 표시
        const stationList = document.getElementById('stationList');
        const sidebarTitle = document.querySelector('#sidebar-content > h3');
        let pagination = document.getElementById('pagination');
        
        // 로그인 상태 확인
        const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
        const isLoggedIn = currentUser && currentUser.id;
        
        // 현재 활성화된 섹션 확인
        const reservationsSection = document.getElementById('reservations-section');
        const favoritesSection = document.getElementById('favorites-section');
        const couponsSection = document.getElementById('coupons-section');
        const stationsSection = document.getElementById('stations-section');
        
        const isStationsSectionActive = stationsSection && !stationsSection.classList.contains('hidden');
        const isReservationsSectionActive = reservationsSection && !reservationsSection.classList.contains('hidden');
        const isFavoritesSectionActive = favoritesSection && !favoritesSection.classList.contains('hidden');
        const isCouponsSectionActive = couponsSection && !couponsSection.classList.contains('hidden');

        // 페이지네이션이 삭제되었으면 다시 생성
        if (!pagination) {
            if (stationsSection) {
                pagination = document.createElement('div');
                pagination.id = 'pagination';
                pagination.style.display = 'none';
                pagination.style.padding = '16px';
                pagination.style.justifyContent = 'center';
                pagination.style.gap = '8px';
                pagination.style.flexWrap = 'wrap';
                stationsSection.appendChild(pagination);
                console.log('✅ 페이지네이션 재생성 완료');
            }
        }

        // 목록 섹션이 활성화되어 있으면 목록 표시
        if (isStationsSectionActive) {
            if (stationList) {
                stationList.classList.remove('hidden');
                stationList.style.display = 'block';
                console.log('✅ 목록 표시');
            }

            if (sidebarTitle) {
                sidebarTitle.classList.remove('hidden');
                sidebarTitle.style.display = 'block';
                console.log('✅ 제목 표시');
            }

            // 페이지네이션 다시 표시
            if (pagination && window.currentStationsList && window.currentStationsList.length > itemsPerPage) {
                pagination.style.display = 'flex';
                console.log('✅ 페이지네이션 표시');
            }
            
            // 사이드바 리스트 자동 갱신 재시작
            if (window.currentStationsList && window.currentStationsList.length > 0) {
                displaySidebarStations(window.currentStationsList);
            } else if (window.currentStations && window.currentStations.length > 0) {
                displaySidebarStations(window.currentStations);
            }
        }
        
        // 로그인 상태에서 내 예약/즐겨찾기/쿠폰 섹션의 리스트 다시 표시
        if (isLoggedIn) {
            if (isReservationsSectionActive) {
                const reservationsList = document.getElementById('reservations-list');
                if (reservationsList) {
                    reservationsList.style.display = 'block';
                    console.log('✅ 예약 목록 표시');
                }
                const sectionTitle = reservationsSection.querySelector('h3');
                if (sectionTitle) {
                    sectionTitle.style.display = 'block';
                }
            }
            if (isFavoritesSectionActive) {
                const favoritesList = document.getElementById('favorites-list');
                if (favoritesList) {
                    favoritesList.style.display = 'block';
                    console.log('✅ 즐겨찾기 목록 표시');
                }
                const sectionTitle = favoritesSection.querySelector('h3');
                if (sectionTitle) {
                    sectionTitle.style.display = 'block';
                }
            }
            if (isCouponsSectionActive) {
                const couponsList = document.getElementById('coupons-list');
                if (couponsList) {
                    couponsList.style.display = 'block';
                    console.log('✅ 쿠폰 목록 표시');
                }
                const sectionTitle = couponsSection.querySelector('h3');
                if (sectionTitle) {
                    sectionTitle.style.display = 'block';
                }
            }
        }
        
        // 상세정보 닫을 때 로그아웃 상태일 때만 로그인 프롬프트 섹션 다시 표시
        if (!isLoggedIn) {
            const loginPromptSection = document.getElementById('login-prompt-section');
            if (loginPromptSection) {
                loginPromptSection.classList.remove('hidden');
                loginPromptSection.style.display = 'block';
                console.log('✅ 로그인 프롬프트 섹션 표시 완료');
            }
        }
        // 로그인 상태일 때는 사용자 정보 섹션이 이미 표시되어 있으므로 별도 처리 불필요

        console.log('=== 목록 화면으로 복귀 완료 ===');
    };

    // 닫기 버튼에 이벤트 연결
    if (sidebarDetailClose) {
        sidebarDetailClose.onclick = handleClose;
        console.log('✅ 닫기 버튼 이벤트 연결 완료');
    } else {
        console.error('❌ 닫기 버튼을 찾을 수 없습니다!');
    }
    
    // 사이드바 리스트 갱신 interval 정리 (상세정보가 열려있을 때는 리스트 갱신 중지)
    if (window.sidebarListUpdateInterval) {
        clearInterval(window.sidebarListUpdateInterval);
        window.sidebarListUpdateInterval = null;
    }
    
    // 실시간 업데이트를 위한 interval 설정
    // 기존 interval이 있으면 제거
    if (window.sidebarDetailUpdateInterval) {
        clearInterval(window.sidebarDetailUpdateInterval);
    }
    
    // 30초마다 상태 업데이트 (예약 시간대 체크)
    window.sidebarDetailUpdateInterval = setInterval(() => {
        const sidebarDetail = document.getElementById('sidebar-detail');
        if (sidebarDetail && !sidebarDetail.classList.contains('hidden')) {
            const currentStation = window.currentSelectedStation;
            if (currentStation && typeof showSidebarDetail === 'function') {
                // 충전소 정보를 다시 로드하여 최신 상태 반영
                // station 객체를 직접 사용하되, 예약 정보만 다시 가져옴
                showSidebarDetail(currentStation);
            }
        } else {
            // 사이드바가 닫혀있으면 interval 정리
            if (window.sidebarDetailUpdateInterval) {
                clearInterval(window.sidebarDetailUpdateInterval);
                window.sidebarDetailUpdateInterval = null;
            }
        }
    }, 30000); // 30초마다 업데이트
    
    // 지도 마커 색상 즉시 반영
    if (typeof window.updateStationsOnMapChange === "function") {
        window.updateStationsOnMapChange();
    }
}

// 시간별 사용량 차트 생성
function generateHourlyUsageChart(container, station, selectedDate = null) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toISOString().split('T')[0];
    const date = selectedDate || todayStr;

    // 날짜 비교 (시간 제외)
    const selectedDateObj = new Date(date + 'T00:00:00');
    const isToday = selectedDateObj.getTime() === today.getTime();

    // 선택한 날짜의 데이터를 백엔드 API에서 가져오기
    fetch(`/api/ev/hourly-usage/${station.id}?date=${date}`)
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            throw new Error('시간별 사용량 API 오류');
        })
        .then(data => {
            // 백엔드에서 받은 데이터 사용
            if (data && Array.isArray(data) && data.length > 0) {
                renderHourlyChart(container, data, date, isToday);
            } else {
                throw new Error('데이터 없음');
            }
        })
        .catch(err => {
            // API가 없거나 실패하면 실시간 데이터 기반으로 계산 (오늘 날짜일 때만)
            if (isToday) {
                console.log('시간별 사용량 API 오류, 실시간 데이터 기반으로 계산:', err);
                const hourlyData = calculateHourlyUsageFromRealtime(station);
                renderHourlyChart(container, hourlyData, date, true);
            } else {
                // 과거 날짜인데 데이터가 없으면 메시지 표시
                container.innerHTML = `
          <div class="hourly-chart-wrapper">
            <div style="color:#999; padding:40px; text-align:center;">
              ${date}의 사용량 데이터를 불러올 수 없습니다.<br/>
              <small style="color:#bbb;">서버에서 데이터를 가져오는 중 오류가 발생했습니다.</small>
            </div>
          </div>
        `;
            }
        });
}

// 실시간 데이터를 기반으로 시간별 사용량 계산
function calculateHourlyUsageFromRealtime(station) {
    const hourlyData = [];
    const now = new Date();
    const currentHour = now.getHours();

    // 실시간 데이터에서 현재 사용량 정확히 계산
    let totalChargers = 0;
    let chargingCount = 0;
    let checkingCount = 0;

    if (station.realtime && Array.isArray(station.realtime)) {
        totalChargers = station.realtime.length;
        station.realtime.forEach(r => {
            const status = r.status || "정보없음";
            if (status.includes("충전중")) {
                chargingCount++;
            } else if (status.includes("점검중")) {
                checkingCount++;
            }
        });
    }

    // 현재 시간대 실제 사용률 계산 (충전 중인 비율)
    const currentUsageRate = totalChargers > 0 ? (chargingCount / totalChargers) * 100 : 0;

    // 24시간 데이터 생성
    for (let hour = 0; hour < 24; hour++) {
        let usage = 0;

        // 현재 시간대는 실시간 데이터로 정확히 계산
        if (hour === currentHour) {
            usage = Math.round(currentUsageRate);
        }
        // 바로 전 시간대는 현재 사용률과 유사하다고 가정 (약간 감소)
        else if (hour === currentHour - 1 || (currentHour === 0 && hour === 23)) {
            usage = Math.max(0, Math.round(currentUsageRate * 0.9));
        }
        // 바로 다음 시간대는 현재 사용률과 유사하다고 가정 (약간 증가)
        else if (hour === currentHour + 1 || (currentHour === 23 && hour === 0)) {
            usage = Math.min(100, Math.round(currentUsageRate * 1.1));
        }
        // 다른 시간대는 패턴 기반 추정
        else {
            const patternMultiplier = getUsagePattern(hour);
            usage = Math.round(currentUsageRate * patternMultiplier);
            usage = Math.max(0, Math.min(100, usage));
        }

        hourlyData.push({
            hour: hour,
            usage: usage,
            label: `${hour}시`,
            isRealtime: hour === currentHour // 현재 시간대 표시용
        });
    }

    return hourlyData;
}

// 시간대별 사용 패턴 (1.0 = 평균, 높을수록 사용량 많음)
function getUsagePattern(hour) {
    // 피크 시간대: 8-10시, 18-20시
    if ((hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 20)) {
        return 1.3; // 피크 시간대는 30% 증가
    }
    // 심야 시간대: 22시-6시
    else if (hour >= 22 || hour <= 6) {
        return 0.5; // 심야는 50% 감소
    }
    // 일반 시간대
    else {
        return 1.0; // 평균
    }
}

// 차트 렌더링
function renderHourlyChart(container, hourlyData, selectedDate = null, isToday = false) {
    // hourlyData가 Map 형태일 경우 배열로 변환
    if (hourlyData && typeof hourlyData === 'object' && !Array.isArray(hourlyData)) {
        hourlyData = Object.keys(hourlyData).map(hour => ({
            hour: parseInt(hour),
            usage: hourlyData[hour],
            label: `${hour}시`,
            isRealtime: false
        })).sort((a, b) => a.hour - b.hour);
    }

    // hourlyData가 배열인지 확인
    if (!Array.isArray(hourlyData) || hourlyData.length === 0) {
        container.innerHTML = '<div style="color:#999; padding:20px; text-align:center;">시간별 사용량 데이터를 불러올 수 없습니다.</div>';
        return;
    }

    // 최대 사용량 찾기 (그래프 높이 계산용)
    const maxUsage = Math.max(...hourlyData.map(d => d.usage || 0), 100);

    // 날짜 표시
    const dateLabel = selectedDate ? formatDateLabel(selectedDate, isToday) : '';

    // 차트 HTML 생성
    const chartHTML = `
    <div class="hourly-chart-wrapper">
      ${dateLabel ? `<div class="chart-date-label">${dateLabel}</div>` : ''}
      <div class="hourly-chart-bars">
        ${hourlyData.map((data, index) => {
        const barHeight = maxUsage > 0 ? ((data.usage || 0) / maxUsage) * 100 : 0;
        const isPeak = (data.hour >= 8 && data.hour <= 10) || (data.hour >= 18 && data.hour <= 20);
        const isRealtime = data.isRealtime || false;
        const barColor = isRealtime ? '#2e7d32' : (isPeak ? '#667eea' : '#9aa0a6');
        const barStyle = isRealtime ? 'border: 2px solid #1b5e20;' : '';
        return `
            <div class="hourly-bar-item">
              <div class="hourly-bar-wrapper">
                <div class="hourly-bar" 
                     style="height: ${barHeight}%; background: ${barColor}; ${barStyle}"
                     title="${data.hour}시: ${data.usage || 0}% 사용${isRealtime ? ' (실시간)' : ''}">
                </div>
              </div>
              <div class="hourly-bar-label" style="${isRealtime ? 'font-weight: 700; color: #2e7d32;' : ''}">${data.hour}</div>
            </div>
          `;
    }).join('')}
      </div>
      <div class="hourly-chart-legend">
        <div class="legend-item">
          <span class="legend-color" style="background: #2e7d32; border: 2px solid #1b5e20;"></span>
          <span>현재 시간 (실시간)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #667eea;"></span>
          <span>피크 시간대</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #9aa0a6;"></span>
          <span>일반 시간대</span>
        </div>
      </div>
    </div>
  `;

    container.innerHTML = chartHTML;
}

// 선택한 요일에 해당하는 날짜 계산
function getDateForWeekday(targetDay) {
    const today = new Date();
    const currentDay = today.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일

    // targetDay와 currentDay의 차이 계산
    let diff = targetDay - currentDay;

    // 오늘 이후의 요일(미래)은 이번 주, 오늘 이전의 요일(과거)은 저번 주
    // 예: 오늘이 수요일(3)이면
    // - 수요일(3) = 오늘 (diff = 0)
    // - 목요일(4) = 저번 주 (diff = 1이지만 과거로 표시하려면 -6)
    // - 금요일(5) = 저번 주 (diff = 2이지만 과거로 표시하려면 -5)
    // - 토요일(6) = 저번 주 (diff = 3이지만 과거로 표시하려면 -4)
    // - 일요일(0) = 저번 주 (diff = -3)
    // - 월요일(1) = 저번 주 (diff = -2)
    // - 화요일(2) = 저번 주 (diff = -1)

    // 오늘이면 오늘 날짜 반환
    if (diff === 0) {
        return today.toISOString().split('T')[0];
    }

    // 오늘 이후의 요일(미래)은 저번 주로 표시
    if (diff > 0) {
        diff -= 7; // 저번 주로 이동
    }
    // diff < 0이면 이미 과거이므로 그대로 사용

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);

    return targetDate.toISOString().split('T')[0];
}

// 날짜 레이블 포맷팅
function formatDateLabel(dateString, isToday = false) {
    if (isToday) {
        return '오늘';
    }

    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
        return '어제';
    }

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];

    return `${month}월 ${day}일 (${weekday})`;
}

// 현재 표시 중인 커스텀 오버레이
let currentOverlay = null;

// 지도 팝업 상세정보 표시 (카카오맵 커스텀 오버레이)
function showStationDetail(station) {
    const mapObj = getMap();
    if (!mapObj) return;

    // 기존 오버레이 제거
    if (currentOverlay) {
        currentOverlay.setMap(null);
        currentOverlay = null;
    }

    // 충전소 상태 계산
    let total = 0, available = 0, charging = 0, checking = 0;
    let slowTotal = 0, slowAvailable = 0;
    let fastTotal = 0, fastAvailable = 0;

    if (station.realtime && Array.isArray(station.realtime)) {
        total = station.realtime.length;
        station.realtime.forEach(r => {
            const status = r.status || "정보없음";
            const speed = r.speed || "";
            const isAvailable = status.includes("충전가능") || status.includes("정보없음");

            if (speed.includes("완속")) {
                slowTotal++;
                if (isAvailable) slowAvailable++;
            } else if (speed.includes("급속")) {
                fastTotal++;
                if (isAvailable) fastAvailable++;
            }

            if (isAvailable) available++;
            else if (status.includes("충전중")) charging++;
            else if (status.includes("점검중")) checking++;
        });
    }

    // 상태 텍스트 및 색상 결정
    let statusText = "이용 가능";
    let statusColor = "#008000";
    if (available === 0 && charging > 0) {
        statusText = "이용 불가";
        statusColor = "#d9534f";
    } else if (available === 0 && checking > 0) {
        statusText = "점검중";
        statusColor = "#ff9800";
    }

    // 충전기 정보 텍스트
    let chargerInfo = "";
    if (slowTotal > 0) {
        chargerInfo = `완속 ${slowAvailable}/${slowTotal}`;
    }
    if (fastTotal > 0) {
        if (chargerInfo) chargerInfo += " | ";
        chargerInfo += `급속 ${fastAvailable}/${fastTotal}`;
    }
    if (!chargerInfo) chargerInfo = "정보없음";

    // 이용 제한 여부 확인 (충전소 이름에 "이용제한"이 포함되어 있는지 확인)
    const hasRestriction = station.name && (station.name.includes("이용제한") || station.name.includes("이용 제한"));
    const restrictionText = hasRestriction ? "이용 제한" : "이용 가능";
    const restrictionColor = hasRestriction ? "#d9534f" : "#008000";

    // 커스텀 오버레이 HTML 생성
    const content = `
    <div class="custom-overlay">
      <div class="overlay-header">
        <div class="overlay-status">
          <span class="status-badge" style="color: ${statusColor};">${statusText}</span>
          <span class="charger-info">${chargerInfo}</span>
        </div>
        <button class="overlay-close">×</button>
      </div>
      <div class="overlay-body">
        <div class="overlay-operator">${station.operator || '미등록'}</div>
        <div class="overlay-name">${station.name}</div>
        <div class="overlay-addr">${station.addr}</div>
        <div class="overlay-buttons">
          <button class="overlay-btn" style="color: ${restrictionColor};">${restrictionText}</button>
        </div>
        <div class="overlay-footer">
          <a href="#" class="overlay-link" onclick="window.handleDetailClick(event); return false;">상세 정보 보기</a>
          <a href="#" class="overlay-link favorite-link" onclick="window.addToFavoritesFromOverlay(event, '${station.name.replace(/'/g, "\\'")}', '${(station.addr || '').replace(/'/g, "\\'")}', ${station.lat}, ${station.lng}); return false;">
            <span class="favorite-star">⭐</span> 즐겨찾기
          </a>
        </div>
      </div>
    </div>
  `;

    // 커스텀 오버레이 생성
    const position = new kakao.maps.LatLng(station.lat, station.lng);

    // HTML 요소 생성
    const overlayDiv = document.createElement('div');
    overlayDiv.innerHTML = content;
    overlayDiv.className = 'custom-overlay-container';

    // 현재 선택된 충전소 저장 (이벤트 리스너 연결 전에 저장)
    window.currentSelectedStation = station;
    console.log('오버레이 생성, 선택된 충전소 저장:', station);
    console.log('생성된 HTML 내용 확인:', overlayDiv.innerHTML.substring(0, 200));

    // 이벤트 리스너 직접 연결
    const closeBtn = overlayDiv.querySelector('.overlay-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.closeMapOverlay();
        });
    }


    // 마커 바로 위에 오버레이 표시
    const viewportWidth = window.innerWidth;
    let yAnchor = 1.25; // 기본값 - 마커 바로 위에 표시

    // 작은 화면에서도 마커 바로 위에 표시
    if (viewportWidth <= 800) {
        yAnchor = 1.25; // 마커 바로 위
    } else if (viewportWidth <= 600) {
        yAnchor = 1.25; // 작은 화면에서도 마커 바로 위
    }

    currentOverlay = new kakao.maps.CustomOverlay({
        position: position,
        content: overlayDiv,
        yAnchor: yAnchor,
        xAnchor: 0.5,
        zIndex: 1000
    });

    currentOverlay.setMap(mapObj);

    console.log('오버레이 지도에 추가 완료');

    // 카카오맵이 DOM을 복사한 후 실제 DOM에 이벤트 연결
    const attachEventToActualDOM = () => {
        const actualLinks = document.querySelectorAll('.custom-overlay .overlay-link');

        actualLinks.forEach((link) => {
            const linkText = link.textContent.trim();
            if (linkText.includes('상세 정보 보기')) {
                // 이미 이벤트가 연결되어 있으면 스킵
                if (link.getAttribute('data-event-attached') === 'true') {
                    return;
                }

                link.setAttribute('data-event-attached', 'true');

                // 여러 방식으로 이벤트 연결하여 확실하게 작동하도록
                const clickHandler = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    // 지도 클릭 이벤트를 막기 위해 플래그 설정
                    if (typeof window.setMarkerClickFlag === 'function') {
                        window.setMarkerClickFlag(true);
                    }

                    console.log('=== 상세 정보 보기 링크 클릭 이벤트 발생 ===');

                    const selectedStation = window.currentSelectedStation;
                    if (!selectedStation) {
                        console.error('❌ 충전소 정보가 없습니다!');
                        alert('충전소 정보를 찾을 수 없습니다.');
                        return false;
                    }

                    console.log('✅ 충전소 정보 확인됨:', selectedStation.name);

                    // 오버레이 닫기
                    window.closeMapOverlay();

                    // 지도 중심 이동 및 확대 (레벨 2로 설정, 강제 확대)
                    setMapCenterAndLevel(selectedStation.lat, selectedStation.lng, 2, true);

                    // 해당 마커 강조 (크게 만들기)
                    if (typeof highlightMarkerByStation === 'function') {
                        highlightMarkerByStation(selectedStation);
                    }

                    // 사이드바에 상세 정보 표시
                    try {
                        if (typeof showSidebarDetail === 'function') {
                            showSidebarDetail(selectedStation);
                            console.log('showSidebarDetail 함수 호출 완료');
                        }
                    } catch (error) {
                        console.error('showSidebarDetail 호출 중 오류:', error);
                        alert('상세 정보를 표시하는 중 오류가 발생했습니다: ' + error.message);
                    }

                    // 플래그 리셋
                    setTimeout(() => {
                        if (typeof window.setMarkerClickFlag === 'function') {
                            window.setMarkerClickFlag(false);
                        }
                    }, 100);

                    return false;
                };

                // onclick 속성과 addEventListener 둘 다 사용
                link.setAttribute('onclick', 'window.handleDetailClick(event); return false;');
                link.addEventListener('click', clickHandler, true); // capture phase에서 먼저 실행
                link.addEventListener('mousedown', function(e) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }, true);

                link.style.cursor = 'pointer';
                link.style.textDecoration = 'underline';
                link.style.pointerEvents = 'auto';
                console.log('✅ 실제 DOM에 이벤트 연결 완료');
            }
        });
    };

    // 즉시 실행 및 재시도
    requestAnimationFrame(() => {
        attachEventToActualDOM();
    });
    setTimeout(attachEventToActualDOM, 50);
    setTimeout(attachEventToActualDOM, 150);
    setTimeout(attachEventToActualDOM, 300);
}

// 상세 정보 보기 링크 클릭 핸들러 (전역 - onclick 속성에서 호출)
window.handleDetailClick = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }

    // 지도 클릭 이벤트를 막기 위해 플래그 설정
    if (typeof window.setMarkerClickFlag === 'function') {
        window.setMarkerClickFlag(true);
    }

    console.log('=== 상세 정보 보기 링크 클릭 이벤트 발생 ===');

    // 충전소 정보를 먼저 저장 (closeMapOverlay에서 null로 설정되기 전에)
    const selectedStation = window.currentSelectedStation;
    console.log('현재 선택된 충전소:', selectedStation);

    if (!selectedStation) {
        console.error('❌ 충전소 정보가 없습니다!');
        alert('충전소 정보를 찾을 수 없습니다.');
        // 플래그 리셋
        setTimeout(() => {
            if (typeof window.setMarkerClickFlag === 'function') {
                window.setMarkerClickFlag(false);
            }
        }, 100);
        return false;
    }

    console.log('✅ 충전소 정보 확인됨:', selectedStation.name);

    // 오버레이 닫기 (이 함수가 currentSelectedStation을 null로 설정함)
    window.closeMapOverlay();

    // 지도 중심 이동 및 확대 (레벨 2로 설정, 강제 확대)
    setMapCenterAndLevel(selectedStation.lat, selectedStation.lng, 2, true);

    // 해당 마커 강조 (크게 만들기)
    if (typeof highlightMarkerByStation === 'function') {
        highlightMarkerByStation(selectedStation);
    }

    // 사이드바에 상세 정보 표시 (즉시 실행)
    console.log('showSidebarDetail 함수 호출 시작');
    console.log('전달할 충전소 정보:', selectedStation);

    try {
        if (typeof showSidebarDetail === 'function') {
            showSidebarDetail(selectedStation);
            console.log('showSidebarDetail 함수 호출 완료');
        } else {
            console.error('❌ showSidebarDetail 함수를 찾을 수 없습니다!');
            alert('상세 정보 표시 함수를 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('showSidebarDetail 호출 중 오류:', error);
        alert('상세 정보를 표시하는 중 오류가 발생했습니다: ' + error.message);
    }

    // 플래그 리셋
    setTimeout(() => {
        if (typeof window.setMarkerClickFlag === 'function') {
            window.setMarkerClickFlag(false);
        }
    }, 100);

    return false;
};

// 오버레이 닫기 함수 (전역)
window.closeMapOverlay = function() {
    if (currentOverlay) {
        currentOverlay.setMap(null);
        currentOverlay = null;
    }
    window.currentSelectedStation = null;
};

// 지도에서 사이드바 상세 정보 표시 (전역)
window.showSidebarFromMap = function(statId) {
    const station = window.currentSelectedStation;
    if (!station) {
        console.warn('선택된 충전소가 없습니다.');
        return;
    }
    console.log('지도에서 사이드바 상세 정보 표시:', station);

    // 오버레이 닫기
    window.closeMapOverlay();

    // 사이드바에서 클릭했을 때와 동일하게 처리
    // 지도 중심 이동 및 확대 (레벨 2로 설정, 강제 확대)
    setMapCenterAndLevel(station.lat, station.lng, 2, true);

    // 해당 마커 강조 (크게 만들기)
    if (typeof highlightMarkerByStation === 'function') {
        highlightMarkerByStation(station);
    }

    // 상세 정보 표시
    showSidebarDetail(station);
};

