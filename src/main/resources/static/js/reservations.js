// 예약 목록 관련 기능

let currentPaymentReservation = null;
let selectedPaymentMethod = 'kakaopay'; // 기본값: 카카오페이
let iamportApiKey = null; // 포트원 API 키

// 포트원 API 키 로드 (초기화는 결제 요청 시에만 수행)
function loadIamportKey() {
    fetch('/payments/iamport-key')
        .then(res => res.json())
        .then(data => {
            iamportApiKey = data.apiKey;
            console.log('포트원 API 키 로드 완료');
        })
        .catch(err => {
            console.error('포트원 API 키 로드 실패:', err);
        });
}

// 결제 모달 열기
function openPaymentModal(reservationId, placeName, reserveDate, reserveTime) {
    currentPaymentReservation = {
        id: reservationId,
        placeName: placeName,
        reserveDate: reserveDate,
        reserveTime: reserveTime
    };
    
    // 모달 정보 업데이트
    document.getElementById('payment-place-name').textContent = placeName;
    const date = new Date(reserveDate + 'T' + reserveTime);
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    document.getElementById('payment-date-time').textContent = `${dateStr} ${timeStr}`;
    
    // 결제 수단 초기화 (카카오페이 기본 선택)
    selectedPaymentMethod = 'kakaopay';
    document.getElementById('payment-method-kakao').classList.add('active');
    document.getElementById('payment-method-toss').classList.remove('active');
    
    // 모달 표시
    document.getElementById('payment-modal').classList.remove('hidden');
    
    // 쿠폰 확인 및 자동 결제
    checkAndUseCoupon();
}

// 쿠폰 확인 및 자동 결제
function checkAndUseCoupon() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        return;
    }
    
    // 사용 가능한 쿠폰 확인
    fetch(`/api/coupons/${user.username}`)
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            return [];
        })
        .then(coupons => {
            // 웰컴 쿠폰 우선 확인
            const welcomeCoupon = coupons.find(c => c.type === 'WELCOME' && !c.used);
            if (welcomeCoupon) {
                // 웰컴 쿠폰으로 자동 결제
                useCouponForPayment(welcomeCoupon.id, 'WELCOME');
                return;
            }
            
            // 무료 쿠폰 확인
            const freeCoupon = coupons.find(c => c.type === 'FREE' && !c.used);
            if (freeCoupon) {
                // 무료 쿠폰으로 자동 결제
                useCouponForPayment(freeCoupon.id, 'FREE');
                return;
            }
        })
        .catch(err => {
            console.error('쿠폰 확인 오류:', err);
        });
}

// 쿠폰으로 결제 처리
function useCouponForPayment(couponId, couponType) {
    if (!currentPaymentReservation) {
        return;
    }
    
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        return;
    }
    
    const couponTypeName = couponType === 'WELCOME' ? '웰컴 쿠폰' : '무료 쿠폰';
    
    if (!confirm(`${couponTypeName}이 있습니다. 쿠폰으로 결제하시겠습니까?`)) {
        return;
    }
    
    // 쿠폰 결제 처리
    fetch('/payments/verify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            impUid: 'COUPON_PAYMENT',
            merchantUid: 'coupon_' + currentPaymentReservation.id + '_' + Date.now(),
            username: user.username,
            placeName: currentPaymentReservation.placeName,
            reserveDate: currentPaymentReservation.reserveDate,
            reserveTime: currentPaymentReservation.reserveTime,
            reservationId: currentPaymentReservation.id,
            couponId: couponId
        })
    })
    .then(res => {
        if (res.ok) {
            return res.text();
        } else {
            return res.text().then(text => {
                throw new Error(text || '쿠폰 결제 실패');
            });
        }
    })
    .then(message => {
        alert(message || `${couponTypeName}으로 결제가 완료되었습니다!`);
        closePaymentModal();
        // 예약 목록 새로고침
        if (typeof loadReservations === 'function') {
            loadReservations();
        }
        // 예약 건수 새로고침
        if (typeof loadReservationCount === 'function') {
            loadReservationCount();
        }
        // 쿠폰 목록 새로고침
        if (typeof loadCoupons === 'function') {
            loadCoupons();
        }
    })
    .catch(err => {
        alert('쿠폰 결제 중 오류가 발생했습니다: ' + err.message);
    });
}

// 결제 모달 닫기
function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
    currentPaymentReservation = null;
}

// 결제 처리
function handlePayment() {
    if (!currentPaymentReservation) {
        alert('결제 정보를 찾을 수 없습니다.');
        return;
    }
    
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        alert('로그인이 필요합니다.');
        return;
    }
    
    // 포트원 API 키 확인
    if (!iamportApiKey) {
        alert('결제 시스템을 초기화하는 중입니다. 잠시 후 다시 시도해주세요.');
        loadIamportKey();
        return;
    }
    
    // 포트원 스크립트 확인
    if (!window.IMP) {
        alert('포트원 스크립트가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
        return;
    }
    
    // 결제 요청 직전에 초기화 (오류 발생 시 무시)
    try {
        window.IMP.init(iamportApiKey);
        console.log('✅ 포트원 초기화 완료');
    } catch (e) {
        console.warn('⚠️ 포트원 초기화 경고:', e);
        // 초기화 오류는 무시하고 결제 요청 진행
    }
    
    const merchantUid = 'reservation_' + currentPaymentReservation.id + '_' + Date.now();
    
    // 포트원 대시보드에서 확인한 PG 코드 사용
    // 카카오페이: PG Provider = kakaopay, MID = TC0ONETIME
    // 토스페이: PG Provider = tosspay, MID = tosstest
    // PG Provider 설정
    let pgCode;

    if (selectedPaymentMethod === 'kakaopay') {
        // 카카오페이 → PG Provider 이름
        pgCode = 'kakaopay';

    } else if (selectedPaymentMethod === 'tosspay') {
        // 토스페이 PG 코드 (포트원 대시보드에서 확인한 값)
        pgCode = 'tosspay';  // 토스페이 PG Provider

    } else {
        pgCode = selectedPaymentMethod;
    }

    
    console.log('🔍 사용할 PG 코드:', pgCode);
    console.log('🔍 선택된 결제 수단:', selectedPaymentMethod);
    
    // 포트원 결제 요청
    const requestData = {
        pg: pgCode,
        merchant_uid: merchantUid,
        name: '충전소 예약 결제',
        amount: 100,
        buyer_email: user.username + '@example.com',
        buyer_name: user.nickname || user.username,
    };
    
    // 토스페이 일반/정기결제 모듈 사용 시
    // pay_method를 설정하지 않으면 사용자가 결제 수단을 선택할 수 있음
    // 필요시 특정 결제 수단만 허용하려면 아래 주석 해제
    // if (selectedPaymentMethod === 'tosspay') {
    //     requestData.pay_method = 'card';  // 카드만
    // }
    
    console.log('💳 결제 요청 데이터:', requestData);
    
    window.IMP.request_pay(requestData, function(rsp) {
        if (rsp.success) {
            // 결제 성공 시 서버에 검증 요청
            fetch('/payments/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    impUid: rsp.imp_uid,
                    merchantUid: merchantUid,
                    username: user.username,
                    placeName: currentPaymentReservation.placeName,
                    reserveDate: currentPaymentReservation.reserveDate,
                    reserveTime: currentPaymentReservation.reserveTime,
                    reservationId: currentPaymentReservation.id
                })
            })
            .then(res => {
                if (res.ok) {
                    return res.text();
                } else {
                    return res.text().then(text => {
                        throw new Error(text || '결제 검증 실패');
                    });
                }
            })
            .then(message => {
                alert(message || '결제가 완료되었습니다!');
                closePaymentModal();
                // 예약 목록 새로고침
                if (typeof loadReservations === 'function') {
                    loadReservations();
                }
                // 예약 건수 새로고침
                if (typeof loadReservationCount === 'function') {
                    loadReservationCount();
                }
            })
            .catch(err => {
                alert('결제 검증 중 오류가 발생했습니다: ' + err.message);
            });
        } else {
            let errorMsg = rsp.error_msg || '알 수 없는 오류';
            
            // 오류 메시지에 따라 안내 메시지 변경
            if (errorMsg.includes('등록된 PG 설정 정보를 찾을 수 없습니다')) {
                const paymentMethodName = selectedPaymentMethod === 'kakaopay' ? '카카오페이' : 
                                         selectedPaymentMethod === 'tosspay' ? '토스페이' : '결제 수단';
                errorMsg = 'PG 설정 오류: 포트원 대시보드에서 ' + paymentMethodName + 
                          ' PG가 등록되어 있는지 확인해주세요.\n\n' +
                          '사용한 PG 코드: ' + pgCode + '\n' +
                          '포트원 대시보드 > 시스템 설정 > PG설정에서 정확한 PG 코드를 확인하고\n' +
                          'reservations.js 파일의 pgCode 값을 수정해주세요.';
            }
            
            console.error('❌ 결제 실패 상세 정보:');
            console.error('- 사용한 PG 코드:', pgCode);
            console.error('- 선택된 결제 수단:', selectedPaymentMethod);
            console.error('- 포트원 응답:', rsp);
            
            alert('결제에 실패했습니다: ' + errorMsg);
        }
    });
}

// 예약 목록 로드
function loadReservations() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        document.getElementById('reservations-list').innerHTML = 
            '<div style="padding: 20px; text-align: center; color: #999;">로그인이 필요합니다.</div>';
        return;
    }

    fetch(`/api/reservations/my`)
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            if (res.status === 401) {
                throw new Error('로그인이 필요합니다.');
            }
            throw new Error('예약 목록 조회 실패');
        })
        .then(reservations => {
            displayReservations(reservations);
            
            // 🔥 예약 목록 갱신 후 상세정보도 갱신
            setTimeout(() => {
                const sidebarDetail = document.getElementById('sidebar-detail');
                if (sidebarDetail && !sidebarDetail.classList.contains('hidden')) {
                    const currentStation = window.currentSelectedStation;
                    if (currentStation && typeof showSidebarDetail === 'function') {
                        // showSidebarDetail 내부에서 예약 정보를 다시 가져오므로 바로 호출
                        showSidebarDetail(currentStation);
                    }
                }
            }, 300);
        })
        .catch(err => {
            console.error('예약 목록 로드 오류:', err);
            document.getElementById('reservations-list').innerHTML = 
                '<div style="padding: 20px; text-align: center; color: #999;">예약 목록을 불러올 수 없습니다.</div>';
        });
}

// 예약 목록 표시
function displayReservations(reservations) {
    const container = document.getElementById('reservations-list');
    
    if (!reservations || reservations.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">예약 내역이 없습니다.</div>';
        return;
    }

    // 현재 시간 기준으로 예약 분류
    const now = new Date();
    const completedReservations = []; // 🔵 충전 예약 완료 (결제 완료 + 아직 종료 안 됨)
    const unpaidReservations = []; // 🟡 미결제 예약
    const pastReservations = []; // 이전 내가 한 예약 (종료된 예약)

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
                const durationMinutes = reservation.duration || 60;
                reserveEndTime.setMinutes(reserveEndTime.getMinutes() + durationMinutes);
                
                // 예약 종료 시간이 현재 시간보다 이후면 현재/미래 예약
                if (reserveEndTime >= now) {
                    if (reservation.paid) {
                        completedReservations.push(reservation);
                    } else {
                        unpaidReservations.push(reservation);
                    }
                } else {
                    // 예약 종료 시간이 지났으면 이전 내역
                    pastReservations.push(reservation);
                }
            } catch (e) {
                // 날짜 파싱 실패 시 결제 여부로 분류
                if (reservation.paid) {
                    completedReservations.push(reservation);
                } else {
                    unpaidReservations.push(reservation);
                }
            }
        } else {
            // 날짜/시간 정보가 없으면 결제 여부로 분류
            if (reservation.paid) {
                completedReservations.push(reservation);
            } else {
                unpaidReservations.push(reservation);
            }
        }
    });

    // 날짜순 정렬 (최신순)
    const sortByDate = (a, b) => {
        try {
            const dateA = new Date(a.reserveDate + 'T' + (a.reserveTime || '00:00'));
            const dateB = new Date(b.reserveDate + 'T' + (b.reserveTime || '00:00'));
            return dateB - dateA; // 최신순
        } catch (e) {
            return 0;
        }
    };
    
    completedReservations.sort(sortByDate);
    unpaidReservations.sort(sortByDate);
    pastReservations.sort(sortByDate);

    // 예약 항목 생성 함수
    const createReservationItem = reservation => {
        const date = new Date(reservation.reserveDate + 'T' + reservation.reserveTime);
        const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const paidStatus = reservation.paid ? '결제완료' : '미결제';
        const paidColor = reservation.paid ? '#2e7d32' : '#f57c00';
        const clickable = !reservation.paid ? 'cursor: pointer;' : '';
        const hoverStyle = !reservation.paid ? 'transition: all 0.2s;' : '';
        
        // 미결제 예약의 남은 시간 계산
        let timeRemaining = '';
        if (!reservation.paid && reservation.createdAt) {
            const createdAt = new Date(reservation.createdAt);
            const now = new Date();
            const diffMs = now - createdAt;
            const diffMins = Math.floor(diffMs / 60000);
            const remainingMins = 10 - diffMins;
            
            if (remainingMins > 0) {
                timeRemaining = `<div style="font-size: 11px; color: #f57c00; margin-top: 4px;">⏰ 결제까지 ${remainingMins}분 남음</div>`;
            } else {
                timeRemaining = '<div style="font-size: 11px; color: #d32f2f; margin-top: 4px;">⚠️ 결제 시간 초과</div>';
            }
        }
        
        return `
            <div class="reservation-item" data-reservation-id="${reservation.id}" data-paid="${reservation.paid}" 
                 style="padding: 16px; margin-bottom: 12px; background: #fff; border: 1px solid #e8eaed; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 16px; color: #333; margin-bottom: 4px;">${reservation.placeName}</div>
                        <div style="font-size: 13px; color: #666;">${dateStr} ${timeStr}</div>
                        ${timeRemaining}
                    </div>
                    <div style="padding: 4px 12px; background: ${reservation.paid ? '#e8f5e9' : '#fff3e0'}; color: ${paidColor}; border-radius: 12px; font-size: 12px; font-weight: 500;">
                        ${paidStatus}
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
                    ${reservation.paid && reservation.amount !== undefined ? `
                        <div style="font-size: 12px; color: #999;">결제 금액: ${reservation.amount}원</div>
                    ` : ''}
                    <div style="display: flex; justify-content: flex-end; gap: 8px; ${reservation.paid ? 'flex: 1;' : ''}">
                        ${!reservation.paid ? `
                            <button onclick="openPaymentModal(${reservation.id}, '${reservation.placeName}', '${reservation.reserveDate}', '${reservation.reserveTime}')" 
                                    style="padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                                💳 결제
                            </button>
                        ` : ''}
                        <button onclick="cancelReservation(${reservation.id}, ${reservation.paid})" 
                                style="padding: 8px 16px; background: ${reservation.paid ? '#ffebee' : '#f5f5f5'}; color: ${reservation.paid ? '#c62828' : '#666'}; border: 1px solid ${reservation.paid ? '#ef9a9a' : '#e0e0e0'}; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                            ${reservation.paid ? '예약 취소' : '취소'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    // HTML 생성
    let html = '';
    
    // 🔵 충전 예약 완료 섹션
    if (completedReservations.length > 0) {
        html += '<div style="margin-bottom: 24px;">';
        html += '<h3 style="font-size: 18px; font-weight: 600; color: #1976d2; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e8eaed;">🔵 충전 예약 완료</h3>';
        html += completedReservations.map(createReservationItem).join('');
        html += '</div>';
    }
    
    // 🟡 미결제 예약 섹션
    if (unpaidReservations.length > 0) {
        html += '<div style="margin-bottom: 24px;">';
        html += '<h3 style="font-size: 18px; font-weight: 600; color: #f57c00; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e8eaed;">🟡 미결제 예약</h3>';
        html += unpaidReservations.map(createReservationItem).join('');
        html += '</div>';
    }
    
    // 이전 내가 한 예약 섹션
    if (pastReservations.length > 0) {
        html += '<div>';
        html += '<h3 style="font-size: 18px; font-weight: 600; color: #666; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e8eaed;">이전 내가 한 예약</h3>';
        html += pastReservations.map(createReservationItem).join('');
        html += '</div>';
    }
    
    if (html === '') {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">예약 내역이 없습니다.</div>';
    } else {
        container.innerHTML = html;
    }
}

// 결제 모달 초기화
function initPaymentModal() {
    // 결제 모달 닫기 버튼
    const paymentModalClose = document.getElementById('payment-modal-close');
    if (paymentModalClose) {
        paymentModalClose.addEventListener('click', closePaymentModal);
    }
    
    // 결제 모달 배경 클릭 시 닫기
    const paymentModal = document.getElementById('payment-modal');
    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target.id === 'payment-modal') {
                closePaymentModal();
            }
        });
    }
    
    // 결제 수단 선택 버튼 (클릭 시 바로 결제 진행)
    const paymentMethodKakao = document.getElementById('payment-method-kakao');
    const paymentMethodToss = document.getElementById('payment-method-toss');
    
    if (paymentMethodKakao) {
        paymentMethodKakao.addEventListener('click', function() {
            selectedPaymentMethod = 'kakaopay';
            paymentMethodKakao.classList.add('active');
            paymentMethodToss.classList.remove('active');
            // 바로 결제 진행
            handlePayment();
        });
    }
    
    if (paymentMethodToss) {
        paymentMethodToss.addEventListener('click', function() {
            selectedPaymentMethod = 'tosspay';
            paymentMethodToss.classList.add('active');
            paymentMethodKakao.classList.remove('active');
            // 바로 결제 진행
            handlePayment();
        });
    }
    
    // 취소 버튼
    const paymentCancelBtn = document.getElementById('payment-cancel-btn');
    if (paymentCancelBtn) {
        paymentCancelBtn.addEventListener('click', function() {
            closePaymentModal();
        });
    }
    
    // 쿠폰으로 결제하기 버튼
    const paymentCouponBtn = document.getElementById('payment-coupon-btn');
    if (paymentCouponBtn) {
        paymentCouponBtn.addEventListener('click', function() {
            handleCouponPayment();
        });
    }
}

// 쿠폰으로 결제하기 (수동)
function handleCouponPayment() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        alert('로그인이 필요합니다.');
        return;
    }
    
    if (!currentPaymentReservation) {
        alert('결제 정보를 찾을 수 없습니다.');
        return;
    }
    
    // 사용 가능한 쿠폰 확인
    fetch(`/api/coupons/${user.username}`)
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            return [];
        })
        .then(coupons => {
            // 웰컴 쿠폰 우선 확인
            const welcomeCoupon = coupons.find(c => c.type === 'WELCOME' && !c.used);
            if (welcomeCoupon) {
                useCouponForPayment(welcomeCoupon.id, 'WELCOME');
                return;
            }
            
            // 무료 쿠폰 확인
            const freeCoupon = coupons.find(c => c.type === 'FREE' && !c.used);
            if (freeCoupon) {
                useCouponForPayment(freeCoupon.id, 'FREE');
                return;
            }
            
            // 사용 가능한 쿠폰이 없음
            alert('사용 가능한 웰컴 쿠폰 또는 무료 쿠폰이 없습니다.');
        })
        .catch(err => {
            console.error('쿠폰 확인 오류:', err);
            alert('쿠폰 확인 중 오류가 발생했습니다.');
        });
}

// 예약 취소 함수
function cancelReservation(reservationId, isPaid) {
    const message = isPaid 
        ? '결제 완료된 예약을 취소하시겠습니까?\n(예약이 취소되며 결제는 환불 처리됩니다.)'
        : '예약을 취소하시겠습니까?';
    
    if (!confirm(message)) {
        return;
    }
    
    fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE'
    })
    .then(res => {
        if (res.ok) {
            return res.text();
        } else {
            return res.text().then(text => {
                throw new Error(text || '예약 취소 실패');
            });
        }
    })
    .then(message => {
        alert(message || '예약이 취소되었습니다.');
        // 예약 목록 새로고침
        if (typeof loadReservations === 'function') {
            loadReservations();
        }
        // 예약 건수 새로고침
        if (typeof loadReservationCount === 'function') {
            loadReservationCount();
        }
        // 쿠폰 목록 새로고침 (쿠폰 복구 시)
        if (typeof loadCoupons === 'function') {
            loadCoupons();
        }
        
        // 🔥 지도 마커 즉시 갱신
        if (typeof window.updateStationsOnMapChange === 'function') {
            window.updateStationsOnMapChange();
        }
        
        // 🔥 마커 상태 즉시 업데이트 (예약 정보 반영)
        if (typeof window.updateMarkerStates === 'function') {
            setTimeout(() => {
                window.updateMarkerStates();
            }, 100);
        }
        
        // 🔥 사이드바 리스트 갱신 (예약 상태 반영)
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
        
        // 🔥 사이드바 상세정보가 열려있으면 다시 로드하여 예약 상태 반영
        setTimeout(() => {
        const sidebarDetail = document.getElementById('sidebar-detail');
        if (sidebarDetail && !sidebarDetail.classList.contains('hidden')) {
            const currentStation = window.currentSelectedStation;
            if (currentStation && typeof showSidebarDetail === 'function') {
                    // showSidebarDetail 내부에서 예약 정보를 다시 가져오므로 바로 호출
                    showSidebarDetail(currentStation);
                }
            }
        }, 500);
    })
    .catch(err => {
        alert('예약 취소 실패: ' + err.message);
    });
}

// 전역 함수로 등록
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.cancelReservation = cancelReservation;

// 페이지 로드 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initPaymentModal();
        loadIamportKey();
    });
} else {
    initPaymentModal();
    loadIamportKey();
}

