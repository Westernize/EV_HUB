// =====================
// 게이지바 상태 변수
// =====================
let progress = 0;
let target = 0;
let running = true;
let fakeLoaderInterval = null;

// =====================
// 게이지바 애니메이션 시작
// =====================
function startGaugeBar() {
    const box = document.getElementById("charging-box");
    const fill = document.getElementById("charging-fill");
    const text = document.getElementById("charging-text");

    // 🔥 반드시 3개 요소 모두 존재해야 실행
    if (!box || !fill || !text) {
        console.log("⏳ charging-box 아직 없음 → 재시도 중...");
        setTimeout(startGaugeBar, 50);
        return;
    }
    console.log("⚡ charging-box 로딩 성공!", box);

    function animate() {
        if (!running) return;
        const diff = target - progress;
        const speed = diff > 10 ? 0.12 : diff > 5 ? 0.08 : 0.04;
        progress += diff * speed;
        fill.style.transform = `scaleX(${progress / 100})`;
        fill.style.backgroundPosition = `${progress * 3}% 0`;
        text.textContent = `${Math.floor(progress)}%`;
        if (progress < 100) requestAnimationFrame(animate);
    }

    // 자연스러운 증가
    fakeLoaderInterval = setInterval(() => {
        if (target < 95) {
            target += Math.random() * 1.2 + 0.6;
        }
    }, 130);

    animate();
}

// =====================
// 로딩 애니메이션 시작
// =====================
function startLoadingAnimation() {
    // 🔥 DOM 완성 후 무조건 실행되게 보장
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startGaugeBar);
    } else {
        startGaugeBar();
    }
}

// =====================
// 게이지바 완료
// =====================
function finishGaugeBar() {
    const fill = document.getElementById("charging-fill");
    const text = document.getElementById("charging-text");
    if (!fill || !text) return;

    clearInterval(fakeLoaderInterval);
    running = false;
    target = 100;
    fill.style.transform = "scaleX(1)";
    text.textContent = "100%";
    fill.classList.add("charged");
}

// =====================
// 로딩 완료 처리
// =====================
function finishLoading() {
    const loadingScreen = document.getElementById("loading-screen");

    finishGaugeBar();

    if (!loadingScreen) return;

    setTimeout(() => {
        loadingScreen.classList.add("fade-out");
        setTimeout(() => {
            loadingScreen.remove();

            // 지도 보이기
            const mapElement = document.getElementById('map');
            const sidebarElement = document.getElementById('sidebar');
            if (mapElement) mapElement.classList.add('loaded');
            if (sidebarElement) sidebarElement.classList.add('loaded');
            document.body.classList.add('loaded');

            // 지도 재계산
            const map = window.getMap ? window.getMap() : null;
            if (map) {
                setTimeout(() => {
                    map.relayout();
                    kakao.maps.event.trigger(map, 'resize');
                }, 200);
            }
        }, 1000);
    }, 800);
}

// =====================
// 에러 처리
// =====================
function gaugeBarError() {
    const fill = document.getElementById("charging-fill");
    const text = document.getElementById("charging-text");
    if (!fill || !text) return;

    clearInterval(fakeLoaderInterval);
    running = false;
    text.textContent = "⚠ 오류";
    fill.style.background = "#ff4444";
}

// =====================
// 로딩 에러 처리
// =====================
function handleLoadingError(error) {
    gaugeBarError();
    const loadingScreen = document.getElementById("loading-screen");

    if (!loadingScreen) return;

    setTimeout(() => {
        loadingScreen.classList.add("fade-out");
        setTimeout(() => {
            loadingScreen.remove();
            alert(`데이터 로드 실패: ${error.message}`);
        }, 1000);
    }, 2000);
}
