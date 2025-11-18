// 쿠폰 관련 기능

// 쿠폰 목록 로드
function loadCoupons() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        document.getElementById('coupons-list').innerHTML = 
            '<div style="padding: 20px; text-align: center; color: #999;">로그인이 필요합니다.</div>';
        return;
    }

    fetch(`/api/coupons/${user.username}`)
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            throw new Error('쿠폰 조회 실패');
        })
        .then(coupons => {
            displayCoupons(coupons);
        })
        .catch(err => {
            console.error('쿠폰 로드 오류:', err);
            document.getElementById('coupons-list').innerHTML = 
                '<div style="padding: 20px; text-align: center; color: #999;">쿠폰을 불러올 수 없습니다.</div>';
        });
}

// 쿠폰 목록 표시
function displayCoupons(coupons) {
    const container = document.getElementById('coupons-list');
    
    if (!coupons || coupons.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">보유한 쿠폰이 없습니다.</div>';
        return;
    }

    // 쿠폰 타입별로 그룹화
    const grouped = {
        WELCOME: [],
        NORMAL: [],
        FREE: []
    };

    coupons.forEach(coupon => {
        if (grouped[coupon.type]) {
            grouped[coupon.type].push(coupon);
        }
    });

    const welcomeCount = grouped.WELCOME.length;
    const normalCount = grouped.NORMAL.length;
    const freeCount = grouped.FREE.length;

    let html = `
        <div style="display: flex; flex-direction: column; gap: 16px; padding: 20px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                <div style="padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${welcomeCount}</div>
                    <div style="font-size: 12px; opacity: 0.9;">웰컴</div>
                </div>
                <div style="padding: 16px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; color: white; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${normalCount}</div>
                    <div style="font-size: 12px; opacity: 0.9;">일반</div>
                </div>
                <div style="padding: 16px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 12px; color: white; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">${freeCount}</div>
                    <div style="font-size: 12px; opacity: 0.9;">무료</div>
                </div>
            </div>

            ${normalCount >= 5 ? `
                <button onclick="exchangeCoupons()" class="auth-btn primary" style="width: 100%;">
                    일반 쿠폰 5장 → 무료 쿠폰 1장 교환
                </button>
            ` : `
                <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; text-align: center; color: #666; font-size: 13px;">
                    일반 쿠폰 5장 이상 보유 시 무료 쿠폰으로 교환 가능합니다. (현재: ${normalCount}장)
                </div>
            `}

            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 12px; color: #333; font-size: 14px; font-weight: 600;">보유 쿠폰 목록</h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${coupons.map(coupon => {
                        const typeNames = {
                            WELCOME: '웰컴 쿠폰',
                            NORMAL: '일반 쿠폰',
                            FREE: '무료 쿠폰'
                        };
                        const typeColors = {
                            WELCOME: '#667eea',
                            NORMAL: '#f5576c',
                            FREE: '#00f2fe'
                        };
                        const date = new Date(coupon.createdAt);
                        const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                        
                        return `
                            <div style="padding: 12px; background: #fff; border: 1px solid #e8eaed; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600; color: ${typeColors[coupon.type]}; font-size: 14px;">${typeNames[coupon.type] || coupon.type}</div>
                                    <div style="font-size: 12px; color: #999; margin-top: 4px;">발급일: ${dateStr}</div>
                                </div>
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${typeColors[coupon.type]};"></div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// 쿠폰 교환
function exchangeCoupons() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        alert('로그인이 필요합니다.');
        return;
    }

    if (!confirm('일반 쿠폰 5장을 무료 쿠폰 1장으로 교환하시겠습니까?')) {
        return;
    }

    fetch(`/api/coupons/exchange/${user.username}`, {
        method: 'POST'
    })
    .then(res => {
        if (res.ok) {
            return res.text();
        } else {
            return res.text().then(text => {
                throw new Error(text || '교환 실패');
            });
        }
    })
    .then(message => {
        alert(message);
        loadCoupons(); // 목록 새로고침
    })
    .catch(err => {
        alert(err.message || '쿠폰 교환에 실패했습니다.');
    });
}

// 전역 함수로 등록
window.exchangeCoupons = exchangeCoupons;

