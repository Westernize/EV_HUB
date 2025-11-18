// 로그인/회원가입 관련 기능

// 현재 로그인한 사용자 정보
let currentUser = null;

// 예약 건수 로드
function loadReservationCount() {
    fetch('/api/reservations/my')
        .then(res => {
            if (res.status === 401) {
                // 인증 실패 시 빈 배열 반환 (조용히 처리)
                return [];
            }
            if (res.ok) {
                return res.json();
            }
            return [];
        })
        .catch(() => {
            // 네트워크 오류 등은 조용히 처리
            return [];
        })
        .then(reservations => {
            const count = reservations ? reservations.length : 0;
            const countElement = document.getElementById('user-reservation-count');
            if (countElement) {
                countElement.textContent = `내 예약: ${count}건`;
            }
        })
        .catch(err => {
            console.error('예약 건수 로드 오류:', err);
            const countElement = document.getElementById('user-reservation-count');
            if (countElement) {
                countElement.textContent = '내 예약: 0건';
            }
        });
}

// 사이드바 로그인 버튼 및 사용자 정보 업데이트
function updateLoginButton(user) {
    const loginBtn = document.getElementById('menu-login');
    const loginLink = document.getElementById('login-link');
    const registerLink = document.getElementById('register-link');
    const contentLoginBtn = document.getElementById('content-login-btn');
    const contentLoginIcon = document.getElementById('content-login-icon');
    const contentLoginText = document.getElementById('content-login-text');
    const loginButtonSection = document.getElementById('login-button-section');
    const userInfoSection = document.getElementById('user-info-section');
    const loginPromptSection = document.getElementById('login-prompt-section');
    
    if (!loginBtn) return;
    
    if (user && user.id) {
        // 로그인된 상태
        const nickname = user.nickname || user.username || '사용자';
        const username = user.username || '';
        const initial = nickname.charAt(0).toUpperCase();
        
        // 사이드바 메뉴 버튼 업데이트 - 로그아웃으로 변경
        if (loginLink) {
            loginLink.textContent = nickname.length > 4 ? nickname.substring(0, 4) + '...' : nickname;
            loginLink.style.textDecoration = 'none';
        }
        if (registerLink) {
            registerLink.textContent = '로그아웃';
            registerLink.style.textDecoration = 'none';
        }
        loginBtn.title = `${nickname} (로그아웃)`;
        
        // 로그인 버튼 섹션 숨김
        if (loginButtonSection) {
            loginButtonSection.style.display = 'none';
        }
        
        // 로그인 프롬프트 섹션 숨김
        if (loginPromptSection) {
            loginPromptSection.classList.add('hidden');
        }
        
        // 사용자 정보 섹션 표시
        if (userInfoSection) {
            userInfoSection.classList.remove('hidden');
            document.getElementById('user-nickname').textContent = nickname;
            document.getElementById('user-username').textContent = username ? `@${username}` : '';
            document.getElementById('user-initial').textContent = initial;
            
            // 예약 건수 로드
            loadReservationCount();
        }
        
        // 챗봇 컨테이너 높이 조정 (로그인 상태: 81vh)
        const chatbotContainer = document.getElementById('chatbot-container');
        if (chatbotContainer) {
            chatbotContainer.style.height = '81vh';
            chatbotContainer.style.maxHeight = '81vh';
        }
    } else {
        // 로그인 안 된 상태
        if (loginLink) {
            loginLink.textContent = '로그인';
            loginLink.style.textDecoration = 'none';
        }
        if (registerLink) {
            registerLink.textContent = '회원가입';
            registerLink.style.textDecoration = 'none';
        }
        loginBtn.title = '로그인';
        
        // 로그인 버튼 섹션 표시
        if (loginButtonSection) {
            loginButtonSection.style.display = 'block';
        }
        if (contentLoginIcon && contentLoginText) {
            contentLoginIcon.textContent = '🔐';
            contentLoginText.textContent = '로그인';
        }
        
        // 사용자 정보 섹션 숨김
        if (userInfoSection) {
            userInfoSection.classList.add('hidden');
        }
        
        // 로그인 프롬프트 섹션 표시
        if (loginPromptSection) {
            loginPromptSection.classList.remove('hidden');
        }
        
        // 챗봇 컨테이너 높이 조정 (로그인 안 된 상태: 91vh)
        const chatbotContainer = document.getElementById('chatbot-container');
        if (chatbotContainer) {
            chatbotContainer.style.height = '91vh';
            chatbotContainer.style.maxHeight = '91vh';
        }
    }
}

// 페이지 로드 시 로그인 상태 확인
function checkLoginStatus() {
    fetch('/users/check-session')
        .then(res => res.json())
        .then(user => {
            if (user && user.id) {
                currentUser = user;
                updateLoginButton(user);
            } else {
                currentUser = null;
                updateLoginButton(null);
            }
        })
        .catch(() => {
            currentUser = null;
            updateLoginButton(null);
        });
}

// 사용자 정보 표시 (로그인 상태 업데이트)
function showUserInfo(user) {
    currentUser = user;
    updateLoginButton(user);

    // 현재 표시 중인 섹션의 데이터 새로고침
    const favoritesSection = document.getElementById('favorites-section');
    const couponsSection = document.getElementById('coupons-section');
    const reservationsSection = document.getElementById('reservations-section');

    if (favoritesSection && !favoritesSection.classList.contains('hidden') && typeof loadFavorites === 'function') {
        loadFavorites();
    }
    if (couponsSection && !couponsSection.classList.contains('hidden') && typeof loadCoupons === 'function') {
        loadCoupons();
    }
    if (reservationsSection && !reservationsSection.classList.contains('hidden') && typeof loadReservations === 'function') {
        loadReservations();
    }
    
    // 예약 건수도 새로고침
    if (user && user.id) {
        loadReservationCount();
    }
}


// 로그아웃 처리
function handleLogout() {
    fetch('/users/logout', {
        method: 'POST'
    })
    .then(() => {
        currentUser = null;
        updateLoginButton(null);
        alert('로그아웃되었습니다.');
        // 즐겨찾기, 쿠폰, 예약 섹션 새로고침
        if (typeof loadFavorites === 'function') {
            loadFavorites();
        }
        if (typeof loadCoupons === 'function') {
            loadCoupons();
        }
        if (typeof loadReservations === 'function') {
            loadReservations();
        }
    })
    .catch(() => {
        // 세션 기반이므로 클라이언트에서만 처리
        currentUser = null;
        updateLoginButton(null);
        alert('로그아웃되었습니다.');
    });
}

// 내 정보 모달 표시
function showMyInfo() {
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        window.location.href = '/login';
        return;
    }

    const userInfoHTML = `
        <div style="display: flex; flex-direction: column; gap: 24px;">
            <!-- 프로필 영역 -->
            <div style="text-align: center; padding: 20px;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: bold; margin-bottom: 16px;">
                    ${(currentUser.nickname || currentUser.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div style="font-size: 20px; font-weight: 600; color: #333; margin-bottom: 4px;">${currentUser.nickname || currentUser.username || '사용자'}</div>
                <div style="font-size: 14px; color: #666;">@${currentUser.username || ''}</div>
            </div>

            <!-- 정보 수정 영역 -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333; font-size: 14px;">아이디</label>
                    <input type="text" id="myinfo-username" value="${currentUser.username || ''}" class="auth-input" disabled style="background: #f5f5f5; cursor: not-allowed;" />
                    <div style="font-size: 12px; color: #999; margin-top: 4px;">아이디는 변경할 수 없습니다.</div>
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333; font-size: 14px;">닉네임</label>
                    <input type="text" id="myinfo-nickname" value="${currentUser.nickname || ''}" class="auth-input" placeholder="닉네임을 입력하세요" />
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333; font-size: 14px;">권한</label>
                    <input type="text" id="myinfo-role" value="${currentUser.role || 'USER'}" class="auth-input" disabled style="background: #f5f5f5; cursor: not-allowed;" />
                </div>

                <div style="border-top: 1px solid #e8eaed; padding-top: 16px; margin-top: 8px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333; font-size: 14px;">비밀번호 변경</label>
                    <input type="password" id="myinfo-current-password" class="auth-input" placeholder="현재 비밀번호" />
                    <input type="password" id="myinfo-new-password" class="auth-input" placeholder="새 비밀번호" style="margin-top: 8px;" />
                    <input type="password" id="myinfo-confirm-password" class="auth-input" placeholder="새 비밀번호 확인" style="margin-top: 8px;" />
                </div>
            </div>

            <!-- 버튼 영역 -->
            <div style="display: flex; gap: 12px; margin-top: 8px;">
                <button id="myinfo-save-btn" class="auth-btn primary" style="flex: 1;">저장</button>
                <button id="myinfo-cancel-btn" class="auth-btn secondary" style="flex: 1;">취소</button>
            </div>
        </div>
    `;

    // 모달 내용 업데이트
    document.getElementById('myinfo-content').innerHTML = userInfoHTML;
    
    // 모달 표시
    document.getElementById('myinfo-modal').classList.remove('hidden');

    // 이벤트 리스너 등록 (기존 리스너 제거 후 재등록)
    const saveBtn = document.getElementById('myinfo-save-btn');
    const cancelBtn = document.getElementById('myinfo-cancel-btn');
    
    // 기존 리스너 제거를 위해 새 버튼 생성
    const newSaveBtn = saveBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newSaveBtn.addEventListener('click', handleSaveMyInfo);
    newCancelBtn.addEventListener('click', closeMyInfoModal);
}

// 내 정보 모달 닫기
function closeMyInfoModal() {
    document.getElementById('myinfo-modal').classList.add('hidden');
}

// 내 정보 저장
function handleSaveMyInfo() {
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }

    const nickname = document.getElementById('myinfo-nickname').value.trim();
    const currentPassword = document.getElementById('myinfo-current-password').value;
    const newPassword = document.getElementById('myinfo-new-password').value;
    const confirmPassword = document.getElementById('myinfo-confirm-password').value;

    let hasChanges = false;

    // 닉네임 변경
    if (nickname && nickname !== currentUser.nickname) {
        hasChanges = true;
        fetch('/users/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: currentUser.username,
                nickname: nickname
            })
        })
        .then(res => {
            if (res.ok) {
                return res.json();
            } else {
                return res.text().then(text => {
                    throw new Error(text || '닉네임 변경 실패');
                });
            }
        })
        .then(updatedUser => {
            currentUser.nickname = updatedUser.nickname;
            if (typeof showUserInfo === 'function') {
                showUserInfo(updatedUser);
            }
            alert('닉네임이 변경되었습니다.');
            closeMyInfoModal();
        })
        .catch(err => {
            alert(err.message || '닉네임 변경에 실패했습니다.');
        });
    }

    // 비밀번호 변경
    if (newPassword) {
        hasChanges = true;
        if (!currentPassword) {
            alert('현재 비밀번호를 입력해주세요.');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('새 비밀번호가 일치하지 않습니다.');
            return;
        }
        if (newPassword.length < 4) {
            alert('비밀번호는 4자 이상이어야 합니다.');
            return;
        }

        fetch('/mypage/password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `currentPw=${encodeURIComponent(currentPassword)}&newPw=${encodeURIComponent(newPassword)}`
        })
        .then(res => {
            if (res.ok) {
                return res.text();
            } else {
                return res.text().then(text => {
                    throw new Error(text || '비밀번호 변경 실패');
                });
            }
        })
        .then(message => {
            alert(message);
            // 비밀번호 필드 초기화
            document.getElementById('myinfo-current-password').value = '';
            document.getElementById('myinfo-new-password').value = '';
            document.getElementById('myinfo-confirm-password').value = '';
            closeMyInfoModal();
        })
        .catch(err => {
            alert(err.message || '비밀번호 변경에 실패했습니다.');
        });
    }

    // 변경사항이 없으면
    if (!hasChanges) {
        alert('변경할 내용이 없습니다.');
    }
}

// 초기화
function initAuth() {
    // 사이드바 로그인 버튼 클릭 이벤트
    // 로그인 링크 클릭 이벤트
    const loginLink = document.getElementById('login-link');
    if (loginLink) {
        loginLink.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentUser && currentUser.id) {
                // 로그인된 상태 - 로그아웃 확인
                if (confirm('로그아웃하시겠습니까?')) {
                    handleLogout();
                }
            } else {
                // 로그인 안 된 상태 - 로그인 페이지로 이동
                window.location.href = '/login';
            }
        });
    }

    // 회원가입 링크 클릭 이벤트
    const registerLink = document.getElementById('register-link');
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.stopPropagation();
            // 로그인된 상태면 로그아웃, 아니면 회원가입 페이지로
            if (currentUser && currentUser.id) {
                if (confirm('로그아웃하시겠습니까?')) {
                    handleLogout();
                }
            } else {
                window.location.href = '/register';
            }
        });
    }

    // 사이드바 컨텐츠 로그인 버튼 클릭 이벤트
    const contentLoginBtn = document.getElementById('content-login-btn');
    if (contentLoginBtn) {
        contentLoginBtn.addEventListener('click', () => {
            if (currentUser && currentUser.id) {
                // 로그인된 상태 - 로그아웃 확인
                if (confirm('로그아웃하시겠습니까?')) {
                    handleLogout();
                }
            } else {
                // 로그인 안 된 상태 - 로그인 페이지로 이동
                window.location.href = '/login';
            }
        });
    }

    // 사이드바 로그아웃 버튼 클릭 이벤트
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', () => {
            if (confirm('로그아웃하시겠습니까?')) {
                handleLogout();
            }
        });
    }

    // 사이드바 로그인 버튼 클릭 이벤트
    const sidebarLoginBtn = document.getElementById('sidebar-login-btn');
    if (sidebarLoginBtn) {
        sidebarLoginBtn.addEventListener('click', () => {
            window.location.href = '/login';
        });
    }

    // 사이드바 회원가입 버튼 클릭 이벤트
    const sidebarRegisterBtn = document.getElementById('sidebar-register-btn');
    if (sidebarRegisterBtn) {
        sidebarRegisterBtn.addEventListener('click', () => {
            window.location.href = '/register';
        });
    }

    // 내 정보 모달 닫기 버튼
    const myinfoModalClose = document.getElementById('myinfo-modal-close');
    if (myinfoModalClose) {
        myinfoModalClose.addEventListener('click', closeMyInfoModal);
    }

    // 내 정보 모달 배경 클릭 시 닫기
    const myinfoModal = document.getElementById('myinfo-modal');
    if (myinfoModal) {
        myinfoModal.addEventListener('click', (e) => {
            if (e.target.id === 'myinfo-modal') {
                closeMyInfoModal();
            }
        });
    }

    // 페이지 로드 시 로그인 상태 확인
    checkLoginStatus();
}

// 전역 함수로 등록
window.showMyInfo = showMyInfo;
window.currentUser = () => currentUser;

// currentUser 변수 직접 접근 (reservation.js에서 사용)
window.getCurrentUser = () => currentUser;

