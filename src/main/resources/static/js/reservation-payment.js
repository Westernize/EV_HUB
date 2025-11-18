// =======================
//  예약 모달용 결제 관련 기능
// =======================

let currentReservationPaymentData = null;
let selectedReservationPaymentMethod = 'kakaopay'; // 기본값: 카카오페이
let reservationIamportApiKey = null; // 포트원 API 키

// 포트원 API 키 로드
function loadReservationIamportKey() {
    fetch('/payments/iamport-key')
        .then(res => res.json())
        .then(data => {
            reservationIamportApiKey = data.apiKey;
            console.log('포트원 API 키 로드 완료 (예약 결제)');
        })
        .catch(err => {
            console.error('포트원 API 키 로드 실패:', err);
        });
}

// =======================
//  예약 모달용 결제 모달 열기
// =======================
function openReservationPaymentModal(reservationId, placeName, reserveDate, reserveTime) {
    currentReservationPaymentData = {
        id: reservationId,
        placeName: placeName,
        reserveDate: reserveDate,
        reserveTime: reserveTime
    };
    
    // 모달 정보 업데이트
    document.getElementById('reservation-payment-place-name').textContent = placeName;
    const date = new Date(reserveDate + 'T' + reserveTime);
    const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    document.getElementById('reservation-payment-date-time').textContent = `${dateStr} ${timeStr}`;
    
    // 결제 수단 초기화 (카카오페이 기본 선택)
    selectedReservationPaymentMethod = 'kakaopay';
    const kakaoBtn = document.getElementById('reservation-payment-method-kakao');
    const tossBtn = document.getElementById('reservation-payment-method-toss');
    if (kakaoBtn) kakaoBtn.classList.add('active');
    if (tossBtn) tossBtn.classList.remove('active');
    
    // 모달 표시
    document.getElementById('reservation-payment-modal').classList.remove('hidden');
    
    // 쿠폰 확인 및 자동 결제
    checkAndUseReservationCoupon();
}

// 쿠폰 확인 및 자동 결제 (예약 모달용)
function checkAndUseReservationCoupon() {
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
                useReservationCouponForPayment(welcomeCoupon.id, 'WELCOME');
                return;
            }
            
            // 무료 쿠폰 확인
            const freeCoupon = coupons.find(c => c.type === 'FREE' && !c.used);
            if (freeCoupon) {
                // 무료 쿠폰으로 자동 결제
                useReservationCouponForPayment(freeCoupon.id, 'FREE');
                return;
            }
        })
        .catch(err => {
            console.error('쿠폰 확인 오류:', err);
        });
}

// 쿠폰으로 결제 처리 (예약 모달용)
function useReservationCouponForPayment(couponId, couponType) {
    if (!currentReservationPaymentData) {
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
            merchantUid: 'coupon_' + currentReservationPaymentData.id + '_' + Date.now(),
            username: user.username,
            placeName: currentReservationPaymentData.placeName,
            reserveDate: currentReservationPaymentData.reserveDate,
            reserveTime: currentReservationPaymentData.reserveTime,
            reservationId: currentReservationPaymentData.id,
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
            closeReservationPaymentModal();

            // 예약 목록 갱신
            if (typeof loadReservations === 'function') {
                loadReservations();
            }

            // 예약 건수 갱신
            if (typeof loadReservationCount === 'function') {
                loadReservationCount();
            }

            // 쿠폰 목록 갱신
            if (typeof loadCoupons === 'function') {
                loadCoupons();
            }

            // 🔥 지도 마커 즉시 갱신
            if (typeof updateStationsOnMapChange === 'function') {
                updateStationsOnMapChange();
            }

            // 🔥 사이드바 상세정보 즉시 갱신
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
            alert('쿠폰 결제 중 오류가 발생했습니다: ' + err.message);
        });


// =======================
//  예약 모달용 결제 모달 닫기
// =======================
    function closeReservationPaymentModal() {
        document.getElementById('reservation-payment-modal').classList.add('hidden');
        currentReservationPaymentData = null;
    }

// =======================
//  예약 모달용 결제 처리
// =======================
    function handleReservationPayment() {
        if (!currentReservationPaymentData) {
            alert('결제 정보를 찾을 수 없습니다.');
            return;
        }

        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!user || !user.username) {
            alert('로그인이 필요합니다.');
            return;
        }

        // 포트원 API 키 확인
        if (!reservationIamportApiKey) {
            alert('결제 시스템을 초기화하는 중입니다. 잠시 후 다시 시도해주세요.');
            loadReservationIamportKey();
            return;
        }

        // 포트원 스크립트 확인
        if (!window.IMP) {
            alert('포트원 스크립트가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
            return;
        }

        // 결제 요청 직전에 초기화 (오류 발생 시 무시)
        try {
            window.IMP.init(reservationIamportApiKey);
            console.log('✅ 포트원 초기화 완료 (예약 결제)');
        } catch (e) {
            console.warn('⚠️ 포트원 초기화 경고:', e);
            // 초기화 오류는 무시하고 결제 요청 진행
        }

        const merchantUid = 'reservation_' + currentReservationPaymentData.id + '_' + Date.now();

        // PG Provider 설정
        // 카카오페이: PG Provider = kakaopay, MID = TC0ONETIME
        // 토스페이: PG Provider = tosspay, MID = tosstest
        let pgCode;
        if (selectedReservationPaymentMethod === 'kakaopay') {
            pgCode = 'kakaopay';
        } else if (selectedReservationPaymentMethod === 'tosspay') {
            // 토스페이 PG 코드 (포트원 대시보드에서 확인한 값)
            pgCode = 'tosspay';  // 토스페이 PG Provider
        } else {
            pgCode = selectedReservationPaymentMethod;
        }

        console.log('🔍 사용할 PG 코드:', pgCode);
        console.log('🔍 선택된 결제 수단:', selectedReservationPaymentMethod);

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
        // if (selectedReservationPaymentMethod === 'tosspay') {
        //     requestData.pay_method = 'card';  // 카드만
        // }

        console.log('💳 결제 요청 데이터:', requestData);

        window.IMP.request_pay(requestData, function (rsp) {
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
                        placeName: currentReservationPaymentData.placeName,
                        reserveDate: currentReservationPaymentData.reserveDate,
                        reserveTime: currentReservationPaymentData.reserveTime,
                        reservationId: currentReservationPaymentData.id
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
                        closeReservationPaymentModal();
                        // 예약 목록 새로고침
                        if (typeof loadReservations === 'function') {
                            loadReservations();
                        }
                        // 예약 건수 새로고침
                        if (typeof loadReservationCount === 'function') {
                            loadReservationCount();
                        }

                        // 🔥 지도 마커 즉시 갱신
                        if (typeof updateStationsOnMapChange === 'function') {
                            updateStationsOnMapChange();
                        }

                        // 🔥 사이드바 상세정보 즉시 갱신
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
                        alert('결제 검증 중 오류가 발생했습니다: ' + err.message);
                    });
            } else {
                let errorMsg = rsp.error_msg || '알 수 없는 오류';

                // 오류 메시지에 따라 안내 메시지 변경
                if (errorMsg.includes('등록된 PG 설정 정보를 찾을 수 없습니다')) {
                    const paymentMethodName = selectedReservationPaymentMethod === 'kakaopay' ? '카카오페이' :
                        selectedReservationPaymentMethod === 'tosspay' ? '토스페이' : '결제 수단';
                    errorMsg = 'PG 설정 오류: 포트원 대시보드에서 ' + paymentMethodName +
                        ' PG가 등록되어 있는지 확인해주세요.\n\n' +
                        '사용한 PG 코드: ' + pgCode + '\n' +
                        '포트원 대시보드 > 시스템 설정 > PG설정에서 정확한 PG 코드를 확인하고\n' +
                        'reservation-payment.js 파일의 pgCode 값을 수정해주세요.';
                }

                console.error('❌ 결제 실패 상세 정보:');
                console.error('- 사용한 PG 코드:', pgCode);
                console.error('- 선택된 결제 수단:', selectedReservationPaymentMethod);
                console.error('- 포트원 응답:', rsp);

                alert('결제에 실패했습니다: ' + errorMsg);
            }
        });
    }

// =======================
//  나중에 결제하기 버튼 클릭 처리
// =======================
    function handleReservationPaymentLater() {
        if (!currentReservationPaymentData) {
            alert('예약 정보를 찾을 수 없습니다.');
            return;
        }

        // 예약 완료 메시지 표시
        alert('예약이 완료되었습니다.');

        // 모달 닫기
        closeReservationPaymentModal();

        // 예약 목록 새로고침
        if (typeof loadReservations === 'function') {
            loadReservations();
        }
        // 예약 건수 새로고침
        if (typeof loadReservationCount === 'function') {
            loadReservationCount();
        }
    }

// =======================
//  예약 모달용 결제 모달 초기화
// =======================
    function initReservationPaymentModal() {
        // 닫기 버튼
        const closeBtn = document.getElementById('reservation-payment-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeReservationPaymentModal);
        }

        // 모달 배경 클릭 시 닫기
        const modal = document.getElementById('reservation-payment-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'reservation-payment-modal') {
                    closeReservationPaymentModal();
                }
            });
        }

        // 나중에 결제하기 버튼
        const laterBtn = document.getElementById('reservation-payment-later-btn');
        if (laterBtn) {
            laterBtn.addEventListener('click', handleReservationPaymentLater);
        }

        // 결제 수단 선택 버튼 (클릭 시 바로 결제 진행)
        const paymentMethodKakao = document.getElementById('reservation-payment-method-kakao');
        const paymentMethodToss = document.getElementById('reservation-payment-method-toss');

        if (paymentMethodKakao) {
            paymentMethodKakao.addEventListener('click', function () {
                selectedReservationPaymentMethod = 'kakaopay';
                paymentMethodKakao.classList.add('active');
                if (paymentMethodToss) paymentMethodToss.classList.remove('active');
                // 바로 결제 진행
                handleReservationPayment();
            });
        }

        if (paymentMethodToss) {
            paymentMethodToss.addEventListener('click', function () {
                selectedReservationPaymentMethod = 'tosspay';
                paymentMethodToss.classList.add('active');
                if (paymentMethodKakao) paymentMethodKakao.classList.remove('active');
                // 바로 결제 진행
                handleReservationPayment();
            });
        }

        // 쿠폰으로 결제하기 버튼 (예약 모달용)
        const reservationPaymentCouponBtn = document.getElementById('reservation-payment-coupon-btn');
        if (reservationPaymentCouponBtn) {
            reservationPaymentCouponBtn.addEventListener('click', function () {
                handleReservationCouponPayment();
            });
        }
    }

// 쿠폰으로 결제하기 (예약 모달용, 수동)
    function handleReservationCouponPayment() {
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!user || !user.username) {
            alert('로그인이 필요합니다.');
            return;
        }

        if (!currentReservationPaymentData) {
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
                    useReservationCouponForPayment(welcomeCoupon.id, 'WELCOME');
                    return;
                }

                // 무료 쿠폰 확인
                const freeCoupon = coupons.find(c => c.type === 'FREE' && !c.used);
                if (freeCoupon) {
                    useReservationCouponForPayment(freeCoupon.id, 'FREE');
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

// =======================
//  전역 함수 등록
// =======================
    window.openReservationPaymentModal = openReservationPaymentModal;
    window.closeReservationPaymentModal = closeReservationPaymentModal;

// 페이지 로드 시 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initReservationPaymentModal();
            loadReservationIamportKey();
        });
    } else {
        initReservationPaymentModal();
        loadReservationIamportKey();
    }
}

