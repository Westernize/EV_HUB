// 메뉴 관련 기능

// 섹션 전환 함수
function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    // 로그인 프롬프트 섹션도 숨김
    const loginPromptSection = document.getElementById('login-prompt-section');
    if (loginPromptSection) {
        loginPromptSection.classList.add('hidden');
    }

    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.remove('active');
    });

    const sidebarDetail = document.getElementById('sidebar-detail');
    if (sidebarDetail) {
        sidebarDetail.classList.add('hidden');
        sidebarDetail.style.display = 'none';
    }

    const sidebarContent = document.getElementById('sidebar-content');

    // 로그인 프롬프트 섹션 처리
    if (sectionName === 'login-prompt') {
        if (sidebarContent) {
            sidebarContent.classList.remove('hidden');
            sidebarContent.style.display = 'flex';
        }
        if (loginPromptSection) {
            loginPromptSection.classList.remove('hidden');
        }
        return;
    }

    if (sectionName === 'stations') {
        if (sidebarContent) {
            sidebarContent.classList.remove('hidden');
            sidebarContent.style.display = 'flex';
        }
        const stationList = document.getElementById('stationList');
        const pagination = document.getElementById('pagination');

        if (stationList) {
            stationList.classList.remove('hidden');
            stationList.style.display = 'block';
        }
        if (pagination && window.currentStationsList && window.currentStationsList.length > 20) {
            pagination.style.display = 'flex';
        }
        
        // 로그인 상태 확인하여 로그인 프롬프트 섹션 표시/숨김
        const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!currentUser || !currentUser.id) {
            // 로그인 안 되어 있으면 로그인 프롬프트 섹션 표시
            if (loginPromptSection) {
                loginPromptSection.classList.remove('hidden');
            }
        } else {
            // 로그인 되어 있으면 로그인 프롬프트 섹션 숨김
            if (loginPromptSection) {
                loginPromptSection.classList.add('hidden');
            }
        }
    } else {
        if (sidebarContent) {
            sidebarContent.classList.remove('hidden');
            sidebarContent.style.display = 'flex';
        }
    }

    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    const menuMap = {
        'stations': 'menu-list',
        'reservations': 'menu-filter',
        'favorites': 'menu-favorites',
        'coupons': 'menu-coupons',
        'feedback': 'menu-feedback'
    };

    const menuId = menuMap[sectionName];
    if (menuId) {
        const menuBtn = document.getElementById(menuId);
        if (menuBtn) menuBtn.classList.add('active');
    }

    if (sectionName === 'favorites' && typeof loadFavorites === 'function') loadFavorites();
    if (sectionName === 'coupons' && typeof loadCoupons === 'function') loadCoupons();
    if (sectionName === 'reservations' && typeof loadReservations === 'function') loadReservations();
}

// map-top-controls 위치 조정
function updateMapTopControlsPosition() {
    const sidebar = document.getElementById('sidebar');
    const mapTopControls = document.getElementById('map-top-controls');

    if (!sidebar || !mapTopControls) return;

    mapTopControls.style.left = sidebar.classList.contains('collapsed') ? '60px' : '500px';
}

// ⭐ 지도 중심 저장 후 복구 (열기/닫기 공통)
function restoreMapCenter(savedCenter, savedLevel) {
    const map = getMap();
    if (!map) return;

    setTimeout(() => {
        map.relayout();
        if (savedCenter) map.setCenter(savedCenter);
        if (savedLevel) map.setLevel(savedLevel);
        kakao.maps.event.trigger(map, 'resize');
    }, 80);
}

// 사이드바 열기
function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarContent = document.getElementById('sidebar-content');
    const sidebarDetail = document.getElementById('sidebar-detail');
    const map = getMap();

    if (!sidebar.classList.contains('collapsed')) return;

    let savedCenter = null;
    let savedLevel = null;
    if (map) {
        savedCenter = map.getCenter();
        savedLevel = map.getLevel();
    }

    sidebar.classList.remove('collapsed');
    sidebar.style.backgroundImage = "url('/img/sidebar.png')";
    updateMapTopControlsPosition();

    if (sidebarContent) {
        sidebarContent.style.display = 'flex';
        sidebarContent.classList.remove('hidden');
    }

    if (sidebarDetail) {
        sidebarDetail.classList.add('hidden');
        sidebarDetail.style.display = 'none';
    }

    restoreMapCenter(savedCenter, savedLevel);
}

// 사이드바 닫기
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarContent = document.getElementById('sidebar-content');
    const sidebarDetail = document.getElementById('sidebar-detail');
    const map = getMap();

    if (sidebar.classList.contains('collapsed')) return;

    const savedCenter = map ? map.getCenter() : null;

    sidebar.classList.add('collapsed');
    sidebar.style.backgroundImage = "url('/img/sidebar-menu.png')";
    updateMapTopControlsPosition();

    if (sidebarContent) {
        sidebarContent.style.display = 'none';
        sidebarContent.classList.add('hidden');
    }
    if (sidebarDetail) {
        sidebarDetail.classList.add('hidden');
        sidebarDetail.style.display = 'none';
    }

    restoreMapCenter(savedCenter, null);

    document.querySelectorAll('.menu-item.active').forEach(el => el.classList.remove('active'));
}

// ⭐ 모든 메뉴를 토글 방식으로 바인딩
function bindMenuToggle(menuId, sectionName) {
    const btn = document.getElementById(menuId);
    const section = document.getElementById(`${sectionName}-section`);
    const sidebar = document.getElementById('sidebar');

    if (!btn || !sidebar || !section) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();

        // 로그인이 필요한 섹션인지 확인
        const loginRequiredSections = ['favorites', 'coupons', 'reservations'];
        if (loginRequiredSections.includes(sectionName)) {
            const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
            if (!currentUser || !currentUser.id) {
                // 로그인 안 되어 있으면 로그인 프롬프트 섹션 표시
                openSidebar();
                showSection('login-prompt');
                return;
            }
        }

        const hidden = section.classList.contains('hidden');

        // 섹션이 숨겨져 있으면 → 열기
        if (hidden) {
            openSidebar();
            showSection(sectionName);
        }
        // 이미 보이는 섹션이면 → 접기
        else {
            section.classList.add('hidden');
            closeSidebar();
        }
    });
}

// 메뉴 초기화
function initMenu() {
    // 모든 메뉴를 동일한 토글 방식으로 처리
    bindMenuToggle('menu-list', 'stations');
    bindMenuToggle('menu-filter', 'reservations');
    bindMenuToggle('menu-favorites', 'favorites');
    bindMenuToggle('menu-coupons', 'coupons');
    bindMenuToggle('menu-feedback', 'feedback');
    
    // ⭐ 내 정보 버튼 - 로그인 페이지로 이동 또는 내 정보 모달 표시
    const menuInfo = document.getElementById('menu-info');
    if (menuInfo) {
        menuInfo.addEventListener('click', (e) => {
            e.stopPropagation();

            // 로그인 상태 확인 (getCurrentUser 사용)
            const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
            
            // 로그인 안 되어 있으면 로그인 페이지로 이동
            if (!currentUser || !currentUser.id) {
                window.location.href = '/login';
                return;
            }

            // 로그인 되어 있으면 내 정보 수정 모달 표시
            if (typeof showMyInfo === 'function') {
                showMyInfo();
            } else if (typeof window.showMyInfo === 'function') {
                window.showMyInfo();
            } else {
                alert('내 정보 기능을 사용할 수 없습니다.');
            }
        });
    }
}

window.showSection = showSection;

