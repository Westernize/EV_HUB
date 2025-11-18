// 관리자 대시보드 JavaScript

let currentUser = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    checkAdminSession();
    setupNavigation();
    loadDashboard();
});

// 관리자 세션 확인
async function checkAdminSession() {
    try {
        const response = await fetch('/users/check-session');
        const user = await response.json();
        
        if (!user || user.role !== 'ADMIN') {
            alert('관리자 권한이 필요합니다.');
            window.location.href = '/login';
            return;
        }
        
        currentUser = user;
        document.getElementById('admin-name').textContent = user.nickname || user.username;
    } catch (error) {
        console.error('세션 확인 실패:', error);
        window.location.href = '/login';
    }
}

// 네비게이션 설정
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            switchSection(section);
        });
    });
}

// 섹션 전환
function switchSection(section) {
    // 모든 섹션 숨기기
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    // 모든 네비게이션 비활성화
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 선택한 섹션 표시
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // 선택한 네비게이션 활성화
    const targetNav = document.querySelector(`[data-section="${section}"]`);
    if (targetNav) {
        targetNav.classList.add('active');
    }
    
    // 페이지 제목 변경
    const titles = {
        'dashboard': '대시보드',
        'users': '회원 관리',
        'reservations': '예약 내역'
    };
    document.getElementById('page-title').textContent = titles[section] || '대시보드';
    
    // 섹션별 데이터 로드
    if (section === 'dashboard') {
        loadDashboard();
    } else if (section === 'users') {
        loadUsers();
    } else if (section === 'reservations') {
        loadReservations();
    }
}

// 대시보드 데이터 로드
async function loadDashboard() {
    try {
        // 회원 통계
        const userStatsResponse = await fetch('/admin/stats/users/count');
        if (userStatsResponse.ok) {
            const userStats = await userStatsResponse.json();
            document.getElementById('total-users').textContent = userStats.totalUsers || 0;
            document.getElementById('regular-users').textContent = userStats.regularUsers || 0;
        }
        
        // 예약 통계
        const resStatsResponse = await fetch('/admin/stats/reservations');
        if (resStatsResponse.ok) {
            const resStats = await resStatsResponse.json();
            document.getElementById('total-reservations').textContent = resStats.totalReservations || 0;
            document.getElementById('paid-reservations').textContent = resStats.paidReservations || 0;
        }
    } catch (error) {
        console.error('대시보드 데이터 로드 실패:', error);
    }
}

// 회원 목록 로드
async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row">로딩 중...</td></tr>';
    
    try {
        const response = await fetch('/admin/users');
        if (!response.ok) {
            throw new Error('회원 목록을 불러올 수 없습니다.');
        }
        
        const users = await response.json();
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-row">등록된 회원이 없습니다.</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.username || '-'}</td>
                <td>${user.nickname || '-'}</td>
                <td><span class="badge ${user.role === 'ADMIN' ? 'badge-admin' : 'badge-user'}">${user.role === 'ADMIN' ? '관리자' : '일반'}</span></td>
                <td>-</td>
                <td>
                    <button class="btn-edit" onclick="openEditModal(${user.id}, '${user.username || ''}', '${(user.nickname || '').replace(/'/g, "\\'")}', '${user.role}')">수정</button>
                    ${user.id !== currentUser?.id ? `<button class="btn-danger" onclick="deleteUser(${user.id})">삭제</button>` : ''}
                </td>
            </tr>
        `).join('');
        
        // 검색 기능
        setupUserSearch(users);
    } catch (error) {
        console.error('회원 목록 로드 실패:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="loading-row">오류가 발생했습니다.</td></tr>';
    }
}

// 회원 검색 설정
function setupUserSearch(users) {
    const searchInput = document.getElementById('user-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const keyword = this.value.toLowerCase();
        const rows = document.querySelectorAll('#users-table-body tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(keyword) ? '' : 'none';
        });
    });
}

// 예약 내역 로드
async function loadReservations() {
    const tbody = document.getElementById('reservations-table-body');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">로딩 중...</td></tr>';
    
    try {
        const response = await fetch('/admin/reservations');
        if (!response.ok) {
            throw new Error('예약 내역을 불러올 수 없습니다.');
        }
        
        const reservations = await response.json();
        
        if (reservations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-row">예약 내역이 없습니다.</td></tr>';
            return;
        }
        
        tbody.innerHTML = reservations.map(res => {
            const date = res.reserveDate ? new Date(res.reserveDate).toLocaleDateString('ko-KR') : '-';
            const time = res.reserveTime || '-';
            const amount = res.amount ? res.amount.toLocaleString() + '원' : '-';
            const paid = res.paid ? '결제완료' : '미결제';
            const paidClass = res.paid ? 'badge-paid' : 'badge-unpaid';
            
            return `
                <tr>
                    <td>${res.id}</td>
                    <td>${res.user?.nickname || res.user?.username || '-'}</td>
                    <td>${res.placeName || '-'}</td>
                    <td>${date}</td>
                    <td>${time}</td>
                    <td>${amount}</td>
                    <td><span class="badge ${paidClass}">${paid}</span></td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('예약 내역 로드 실패:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">오류가 발생했습니다.</td></tr>';
    }
}

// 회원 수정 모달 열기
async function openEditModal(userId, username, nickname, role) {
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-nickname').value = nickname;
    document.getElementById('edit-password').value = '';
    document.getElementById('edit-role').value = role;
    
    document.getElementById('edit-user-modal').classList.add('active');
}

// 회원 수정 모달 닫기
function closeEditModal() {
    document.getElementById('edit-user-modal').classList.remove('active');
}

// 회원 정보 수정
document.getElementById('edit-user-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = document.getElementById('edit-user-id').value;
    const nickname = document.getElementById('edit-nickname').value;
    const password = document.getElementById('edit-password').value;
    const role = document.getElementById('edit-role').value;
    
    const updateData = {
        nickname: nickname,
        role: role
    };
    
    if (password) {
        updateData.password = password;
    }
    
    try {
        const response = await fetch(`/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        alert('회원 정보가 수정되었습니다.');
        closeEditModal();
        loadUsers();
    } catch (error) {
        alert('수정 실패: ' + error.message);
    }
});

// 회원 삭제
async function deleteUser(userId) {
    if (!confirm('정말 이 회원을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const response = await fetch(`/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        alert('회원이 삭제되었습니다.');
        loadUsers();
    } catch (error) {
        alert('삭제 실패: ' + error.message);
    }
}

// 로그아웃
async function logout() {
    try {
        await fetch('/users/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('로그아웃 실패:', error);
        window.location.href = '/login';
    }
}

// 모달 외부 클릭 시 닫기
document.getElementById('edit-user-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeEditModal();
    }
});

