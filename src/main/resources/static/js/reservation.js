// =======================
//  예약 관련 전역 변수
// =======================
let currentReservationData = null;

// 예약 시간 범위 업데이트 함수 (전역)
function updateReservationTimeRange() {
    const dateInput = document.getElementById('reservation-date');
    const timeInput = document.getElementById('reservation-time');
    const durationInput = document.getElementById('reservation-duration');
    
    if (!dateInput || !timeInput || !durationInput) return;
    
    const dateValue = dateInput.value;
    const timeValue = timeInput.value;
    const durationValue = parseInt(durationInput.value) || 60;
    
    if (dateValue && timeValue) {
        const startTime = new Date(`${dateValue}T${timeValue}:00`);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + durationValue);
        
        const endHours = String(endTime.getHours()).padStart(2, '0');
        const endMinutes = String(endTime.getMinutes()).padStart(2, '0');
        
        const timeRangeElement = document.getElementById('reservation-time-range');
        if (timeRangeElement) {
            timeRangeElement.textContent = `${timeValue} 부터 ${endHours}:${endMinutes} 까지`;
        }
    } else {
        const timeRangeElement = document.getElementById('reservation-time-range');
        if (timeRangeElement) {
            timeRangeElement.textContent = '--:-- 부터 --:-- 까지';
        }
    }
}


// =======================
//  로그인 유틸 함수
// =======================
function getLoggedInUser() {
    if (typeof window.getCurrentUser === 'function') {
        return window.getCurrentUser();
    }
    if (typeof window.currentUser === 'function') {
        return window.currentUser();
    }
    return null;
}




// =======================
//  예약 모달 열기
// =======================
function openReservationModal(chgerId, stationName) {

    const user = getLoggedInUser();
    if (!user) {
        alert("로그인이 필요합니다.");
        if (typeof showLoginForm === 'function') showLoginForm();
        return;
    }

    currentReservationData = {
        chgerId: chgerId,
        stationName: stationName
    };

    // 모달 UI 업데이트
    document.getElementById('reservation-station-name').textContent = stationName;
    document.getElementById('reservation-charger-id').textContent = `충전기 ID: ${chgerId}`;

    // 오늘 날짜 기본값 설정
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const dateInput = document.getElementById('reservation-date');
    dateInput.min = todayStr;
    dateInput.value = todayStr;

    // 시간 기본값 설정 (현재 시간)
    const timeInput = document.getElementById('reservation-time');
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeInput.value = `${hours}:${minutes}`;
    
    // 예약 시간 입력 필드도 실시간으로 현재 시간 업데이트
    // 사용자가 직접 입력하지 않은 경우에만 업데이트
    window.reservationTimeUserHasChanged = false;
    
    // 사용자가 시간을 변경했는지 추적
    timeInput.addEventListener('input', () => {
        window.reservationTimeUserHasChanged = true;
    });
    
    // 현재 시간을 실시간으로 반영하는 함수
    const updateReservationTimeToCurrent = () => {
        // 사용자가 시간을 변경했거나 입력 필드에 포커스가 있으면 업데이트하지 않음
        if (window.reservationTimeUserHasChanged || timeInput === document.activeElement) {
            return;
        }
        // 모달이 열려있고 사용자가 시간을 변경하지 않았을 때만 업데이트
        const modal = document.getElementById('reservation-modal');
        if (modal && !modal.classList.contains('hidden')) {
            const currentNow = new Date();
            const currentHours = String(currentNow.getHours()).padStart(2, '0');
            const currentMinutes = String(currentNow.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}`;
            // 현재 시간과 다를 때만 업데이트
            if (timeInput.value !== currentTimeStr) {
                timeInput.value = currentTimeStr;
                updateReservationTimeRange();
            }
        }
    };
    
    // 1초마다 현재 시간으로 업데이트
    const reservationTimeUpdateInterval = setInterval(updateReservationTimeToCurrent, 1000);
    
    // 모달이 닫힐 때 interval 정리를 위해 전역 변수에 저장
    window.reservationTimeUpdateInterval = reservationTimeUpdateInterval;
    
    // 초기 업데이트
    updateReservationTimeRange();
    
    // 실시간 업데이트 이벤트 리스너 (중복 방지를 위해 기존 리스너 제거 후 추가)
    timeInput.removeEventListener('input', updateReservationTimeRange);
    dateInput.removeEventListener('change', updateReservationTimeRange);
    timeInput.addEventListener('input', updateReservationTimeRange);
    dateInput.addEventListener('change', updateReservationTimeRange);
    const durationInput = document.getElementById('reservation-duration');
    if (durationInput) {
        durationInput.removeEventListener('change', updateReservationTimeRange);
        durationInput.addEventListener('change', updateReservationTimeRange);
    }

    // 모달 표시
    document.getElementById('reservation-modal').classList.remove('hidden');
}

// =======================
//  예약 모달 닫기
// =======================
function closeReservationModal() {
    document.getElementById('reservation-modal').classList.add('hidden');
    currentReservationData = null;
    
    // 예약 시간 업데이트 interval 정리
    if (window.reservationTimeUpdateInterval) {
        clearInterval(window.reservationTimeUpdateInterval);
        window.reservationTimeUpdateInterval = null;
    }
    window.reservationTimeUserHasChanged = false;
}


// =======================
//  예약 요청 처리
// =======================
function handleReservation() {

    if (!currentReservationData) {
        alert("예약 데이터를 찾을 수 없습니다.");
        return;
    }

    const date = document.getElementById('reservation-date').value;
    const time = document.getElementById('reservation-time').value;
    const duration = parseInt(document.getElementById('reservation-duration').value) || 60;

    if (!date || !time) {
        alert("날짜와 시간을 선택해주세요.");
        return;
    }
    
    // 예약 시간 범위 계산
    const [startHours, startMinutes] = time.split(':').map(Number);
    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + duration);
    
    const endHours = String(endTime.getHours()).padStart(2, '0');
    const endMinutes = String(endTime.getMinutes()).padStart(2, '0');
    
    // 예약 시간 범위 확인 메시지
    const timeRangeMessage = `${time} 부터 ${endHours}:${endMinutes} 까지 (${duration}분)`;
    console.log("예약 시간 범위:", timeRangeMessage);

    const user = getLoggedInUser();
    if (!user || !user.username) {
        alert("로그인이 필요합니다.");
        closeReservationModal();
        return;
    }

    // 백엔드 DTO에 맞춘 데이터
    const reservationData = {
        username: user.username,
        placeName: currentReservationData.stationName,
        reserveDate: date,
        reserveTime: time,   // HH:mm 형태
        chgerId: currentReservationData.chgerId || null  // 충전기 ID 추가
    };

    console.log("📤 예약 요청:", reservationData);

    fetch("/api/reservations/create", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(reservationData)
    })
    .then(res => {
        if (res.ok) return res.text();
        return res.text().then(text => { throw new Error(text || "예약 실패"); });
    })
    .then(message => {
        // 예약 모달 닫기
        closeReservationModal();
        
        // 예약 목록 새로고침 후 최신 미결제 예약 찾기
        return fetch("/api/reservations/my")
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('예약 목록 조회 실패');
            })
            .then(reservations => {
                // 미결제 예약 중 가장 최신 것 찾기
                const unpaidReservations = reservations.filter(r => !r.paid);
                console.log('미결제 예약 목록:', unpaidReservations);
                if (unpaidReservations.length > 0) {
                    // 생성 시간 기준으로 정렬 (최신순)
                    unpaidReservations.sort((a, b) => {
                        const dateA = new Date(a.createdAt || 0);
                        const dateB = new Date(b.createdAt || 0);
                        return dateB - dateA;
                    });
                    const latestReservation = unpaidReservations[0];
                    console.log('최신 미결제 예약:', latestReservation);
                    console.log('openReservationPaymentModal 함수 존재 여부:', typeof window.openReservationPaymentModal);
                    
                    // 예약 모달용 결제 모달 열기 (함수가 등록될 때까지 대기)
                    const tryOpenPaymentModal = (attempts = 0) => {
                        if (typeof window.openReservationPaymentModal === 'function') {
                            console.log('결제 모달 열기 시도');
                            window.openReservationPaymentModal(
                                latestReservation.id,
                                latestReservation.placeName,
                                latestReservation.reserveDate,
                                latestReservation.reserveTime
                            );
                        } else if (attempts < 10) {
                            // 함수가 아직 등록되지 않았으면 100ms 후 다시 시도
                            setTimeout(() => tryOpenPaymentModal(attempts + 1), 100);
                        } else {
                            console.error('openReservationPaymentModal 함수를 찾을 수 없습니다.');
                            alert(message || "예약이 완료되었습니다!");
                        }
                    };
                    tryOpenPaymentModal();
                } else {
                    console.log('미결제 예약이 없습니다.');
                    alert(message || "예약이 완료되었습니다!");
                }
            })
            .catch(err => {
                console.error('예약 목록 조회 오류:', err);
                alert(message || "예약이 완료되었습니다!");
            });
    })
    .then(() => {
        // 예약 목록 새로고침 (있을 경우)
        if (typeof loadReservations === 'function') loadReservations();
        if (typeof loadReservationCount === 'function') loadReservationCount();
        
        // 지도 마커 색상 즉시 갱신
        if (typeof window.updateStationsOnMapChange === "function") {
            window.updateStationsOnMapChange();
        }
        
        // 🔥 마커 상태 즉시 업데이트 (예약 정보 반영)
        if (typeof window.updateMarkerStates === 'function') {
            setTimeout(() => {
                window.updateMarkerStates();
            }, 100);
        }
        
        // 사이드바 리스트 갱신 (예약 상태 반영)
        if (window.currentStationsList && window.currentStationsList.length > 0) {
            if (typeof displaySidebarStations === 'function') {
                setTimeout(() => {
                    displaySidebarStations(window.currentStationsList);
                }, 200);
            }
        } else if (window.currentStations && window.currentStations.length > 0) {
            if (typeof displaySidebarStations === 'function') {
                setTimeout(() => {
                    displaySidebarStations(window.currentStations);
                }, 200);
            }
        }
        
        // 사이드바 상세정보가 열려있으면 다시 로드하여 예약 상태 반영
        const sidebarDetail = document.getElementById('sidebar-detail');
        if (sidebarDetail && !sidebarDetail.classList.contains('hidden')) {
            const currentStation = window.currentSelectedStation;
            if (currentStation && typeof showSidebarDetail === 'function') {
                // 약간의 지연 후 사이드바 상세정보 다시 로드
                setTimeout(() => {
                    showSidebarDetail(currentStation);
                }, 300);
            }
        }
    })
    .catch(err => {
        alert("예약 실패: " + err.message);
    });
}


// =======================
//  예약 모달 이벤트 초기화
// =======================
function initReservation() {

    // 닫기 버튼
    const closeBtn = document.getElementById('reservation-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeReservationModal);

    // 모달 외부 클릭 시 닫기
    const modal = document.getElementById('reservation-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'reservation-modal') {
                closeReservationModal();
            }
        });
    }

    // 제출 버튼
    const submitBtn = document.getElementById('reservation-submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', handleReservation);

    // Enter 키로 제출 및 실시간 업데이트
    const dateInput = document.getElementById('reservation-date');
    const timeInput = document.getElementById('reservation-time');
    const durationInput = document.getElementById('reservation-duration');

    if (dateInput) {
        dateInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') handleReservation();
        });
        dateInput.addEventListener('change', updateReservationTimeRange);
    }
    if (timeInput) {
        timeInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') handleReservation();
        });
        timeInput.addEventListener('input', updateReservationTimeRange);
    }
    if (durationInput) {
        durationInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') handleReservation();
        });
        durationInput.addEventListener('change', updateReservationTimeRange);
    }
}


// =======================
//  전역 함수 등록
// =======================
window.openReservationModal = openReservationModal;
window.closeReservationModal = closeReservationModal;

// 페이지 로드 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReservation);
} else {
    initReservation();
}
