// 즐겨찾기 관련 기능

// 즐겨찾기 목록 로드
function loadFavorites() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        document.getElementById('favorites-list').innerHTML = 
            '<div style="padding: 20px; text-align: center; color: #999;">로그인이 필요합니다.</div>';
        return;
    }

    fetch(`/favorites/user/${user.username}`)
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            throw new Error('즐겨찾기 조회 실패');
        })
        .then(favorites => {
            displayFavorites(favorites);
        })
        .catch(err => {
            console.error('즐겨찾기 로드 오류:', err);
            document.getElementById('favorites-list').innerHTML = 
                '<div style="padding: 20px; text-align: center; color: #999;">즐겨찾기를 불러올 수 없습니다.</div>';
        });
}

// 즐겨찾기 목록 표시
function displayFavorites(favorites) {
    const container = document.getElementById('favorites-list');
    
    if (!favorites || favorites.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">즐겨찾기한 충전소가 없습니다.</div>';
        return;
    }

    container.innerHTML = favorites.map(fav => `
        <div class="favorite-item" style="padding: 16px; margin-bottom: 12px; background: #fff; border: 1px solid #e8eaed; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" 
             onclick="goToFavoriteStation(${fav.lat}, ${fav.lng}, '${fav.placeName}')">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 16px; color: #333; margin-bottom: 4px;">${fav.placeName}</div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 8px;">${fav.address || ''}</div>
                </div>
                <button class="delete-favorite-btn" onclick="event.stopPropagation(); deleteFavorite(${fav.id})" 
                        style="background: #ffebee; border: none; color: #c62828; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">
                    삭제
                </button>
            </div>
        </div>
    `).join('');
}

// 즐겨찾기로 이동
function goToFavoriteStation(lat, lng, placeName) {
    // 지도 중심 이동 및 확대
    if (typeof setMapCenterAndLevel === 'function') {
        setMapCenterAndLevel(lat, lng, 3);
    }

    // 해당 충전소 찾기 및 상세 정보 표시
    if (window.currentStations && Array.isArray(window.currentStations)) {
        const station = window.currentStations.find(s => 
            Math.abs(s.lat - lat) < 0.0001 && Math.abs(s.lng - lng) < 0.0001
        );
        
        if (station) {
            if (typeof showSidebarDetail === 'function') {
                showSidebarDetail(station);
            }
            if (typeof highlightMarkerByStation === 'function') {
                highlightMarkerByStation(station);
            }
        }
    }

    // 목록 섹션으로 전환
    showSection('stations');
}

// 즐겨찾기 삭제
function deleteFavorite(favoriteId) {
    if (!confirm('즐겨찾기를 삭제하시겠습니까?')) {
        return;
    }

    fetch(`/favorites/${favoriteId}`, {
        method: 'DELETE'
    })
    .then(res => res.text())
    .then(message => {
        alert(message);
        loadFavorites(); // 목록 새로고침
    })
    .catch(err => {
        alert('즐겨찾기 삭제에 실패했습니다.');
    });
}

// 즐겨찾기에 추가 (충전소 상세 정보에서 사용)
function addToFavorites(station) {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        alert('로그인이 필요합니다.');
        if (typeof showLoginForm === 'function') {
            showLoginForm();
        }
        return;
    }

    const favoriteData = {
        username: user.username,
        placeName: station.name,
        address: station.addr || '',
        lat: station.lat,
        lng: station.lng
    };

    fetch('/favorites/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(favoriteData)
    })
    .then(res => res.text())
    .then(message => {
        alert(message);
        // 즐겨찾기 섹션이 보이면 새로고침
        if (!document.getElementById('favorites-section').classList.contains('hidden')) {
            loadFavorites();
        }
    })
    .catch(err => {
        alert('즐겨찾기 추가에 실패했습니다.');
    });
}

// 오버레이에서 즐겨찾기 추가
function addToFavoritesFromOverlay(event, placeName, address, lat, lng) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('⭐ 즐겨찾기 추가 시도:', { placeName, address, lat, lng });
    
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !user.username) {
        alert('로그인이 필요합니다.');
        // 로그인 페이지로 리다이렉트
        if (typeof window.location !== 'undefined') {
            window.location.href = '/login';
        }
        return;
    }

    const favoriteData = {
        username: user.username,
        placeName: placeName,
        address: address || '',
        lat: lat,
        lng: lng
    };

    console.log('📤 즐겨찾기 추가 요청:', favoriteData);

    fetch('/favorites/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(favoriteData)
    })
    .then(res => {
        if (res.ok) {
            return res.text();
        } else {
            return res.text().then(text => {
                throw new Error(text || '즐겨찾기 추가 실패');
            });
        }
    })
    .then(message => {
        console.log('✅ 즐겨찾기 추가 성공:', message);
        alert(message);
        // 즐겨찾기 섹션이 보이면 새로고침
        const favoritesSection = document.getElementById('favorites-section');
        if (favoritesSection && !favoritesSection.classList.contains('hidden')) {
            loadFavorites();
        }
    })
    .catch(err => {
        console.error('❌ 즐겨찾기 추가 실패:', err);
        alert('즐겨찾기 추가에 실패했습니다: ' + err.message);
    });
}

// 전역 함수로 등록
window.addToFavorites = addToFavorites;
window.addToFavoritesFromOverlay = addToFavoritesFromOverlay;
window.deleteFavorite = deleteFavorite;
window.goToFavoriteStation = goToFavoriteStation;

