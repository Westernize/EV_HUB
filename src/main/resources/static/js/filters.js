// 필터 관련 기능

// 선택된 충전기 타입 가져오기
function getSelectedChargerTypes() {
    const checkboxes = document.querySelectorAll('#charger-type-panel input[type="checkbox"]');
    const selected = [];
    checkboxes.forEach(chk => {
        if (chk.checked) selected.push(chk.nextSibling.textContent.trim());
    });
    return selected;
}

// 필터 초기화
function initFilters(updateStationsCallback) {
    // 충전타입 필터 패널 닫기 버튼 (패널 본문만 접기/펼치기)
    const closeBtn = document.querySelector('#charger-type-panel .close-btn');
    const panelBody = document.querySelector('#charger-type-panel .panel-body');

    if (closeBtn && panelBody) {
        closeBtn.addEventListener('click', () => {
            panelBody.classList.toggle('hidden');
            closeBtn.textContent = panelBody.classList.contains('hidden') ? "▼" : "×";
        });
    }

    // 전체 체크박스와 개별 체크박스 연동
    const allCheckbox = document.querySelector('#charger-type-panel input[value="전체"]');
    const others = document.querySelectorAll('#charger-type-panel input[type="checkbox"]:not([value="전체"])');

    if (allCheckbox) {
        allCheckbox.addEventListener('change', () => {
            others.forEach(chk => chk.checked = allCheckbox.checked);
            if (updateStationsCallback) updateStationsCallback();
        });
    }

    others.forEach(chk => {
        chk.addEventListener('change', () => {
            if (!chk.checked) {
                if (allCheckbox) allCheckbox.checked = false;
            }
            if (updateStationsCallback) updateStationsCallback();
        });
    });

    // 필터 칩 클릭 이벤트
    const filterAvailable = document.getElementById('filter-available');
    const filterReservable = document.getElementById('filter-reservable');

    // 충전가능 필터
    if (filterAvailable) {
        filterAvailable.addEventListener('click', () => {
            filterAvailable.classList.toggle('active');
            if (updateStationsCallback) updateStationsCallback();
        });
    }

    // 예약가능 필터
    if (filterReservable) {
        filterReservable.addEventListener('click', () => {
            filterReservable.classList.toggle('active');
            if (updateStationsCallback) updateStationsCallback();
        });
    }

}

