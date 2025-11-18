// 챗봇 관련 기능

// FAQ 데이터
const faqData = {
    '예약': {
        question: '예약은 어떻게 하나요?',
        answer: '충전소 목록에서 원하는 충전소를 선택한 후 "예약하기" 버튼을 클릭하세요. 날짜와 시간을 선택하고 예약을 완료하면 결제 화면이 나타납니다. 결제를 완료하면 예약이 확정됩니다.'
    },
    '결제': {
        question: '결제 방법은 무엇인가요?',
        answer: '카카오페이, 토스페이, 그리고 쿠폰으로 결제할 수 있습니다. 결제 금액은 100원입니다. 웰컴 쿠폰이나 무료 쿠폰이 있으면 자동으로 쿠폰 결제가 제안됩니다.'
    },
    '쿠폰': {
        question: '쿠폰은 어떻게 사용하나요?',
        answer: '쿠폰은 3가지 종류가 있습니다:\n\n1. 웰컴 쿠폰: 회원가입 시 지급되는 무료 쿠폰\n2. 무료 쿠폰: 일반 쿠폰 5장을 교환하여 받을 수 있는 쿠폰\n3. 일반 쿠폰: 결제 완료 시 지급되는 쿠폰\n\n웰컴 쿠폰과 무료 쿠폰은 결제 시 자동으로 사용되며, 결제 금액이 0원이 됩니다.'
    },
    '취소': {
        question: '예약 취소는 어떻게 하나요?',
        answer: '내 예약 섹션에서 취소하고 싶은 예약의 "취소" 또는 "예약 취소" 버튼을 클릭하세요. 결제 완료된 예약도 취소할 수 있으며, 쿠폰으로 결제한 경우 쿠폰이 자동으로 복구됩니다.'
    }
};

// 챗봇 메시지 추가
function addChatMessage(message, isUser = false) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user-message' : 'bot-message'}`;
    
    if (isUser) {
        messageDiv.style.cssText = 'padding: 12px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; max-width: 80%; align-self: flex-end; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        messageDiv.innerHTML = `<div style="color: white; font-size: 14px; line-height: 1.5;">${escapeHtml(message)}</div>`;
    } else {
        messageDiv.style.cssText = 'padding: 12px 16px; background: #ffffff; border-radius: 12px; max-width: 80%; align-self: flex-start; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
        messageDiv.innerHTML = `
            <div style="font-weight: 600; color: #667eea; font-size: 13px; margin-bottom: 4px;">EV HUB 챗봇</div>
            <div style="color: #333; font-size: 14px; line-height: 1.5; white-space: pre-line;">${escapeHtml(message)}</div>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// HTML 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 챗봇 응답 생성
function getChatbotResponse(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // FAQ 키워드 매칭
    if (message.includes('예약') || message.includes('예약하기') || message.includes('예약 방법')) {
        return faqData['예약'].answer;
    } else if (message.includes('결제') || message.includes('결제 방법') || message.includes('결제하기')) {
        return faqData['결제'].answer;
    } else if (message.includes('쿠폰') || message.includes('쿠폰 사용') || message.includes('쿠폰 교환')) {
        return faqData['쿠폰'].answer;
    } else if (message.includes('취소') || message.includes('예약 취소') || message.includes('취소 방법')) {
        return faqData['취소'].answer;
    } else if (message.includes('안녕') || message.includes('hello') || message.includes('hi')) {
        return '안녕하세요! EV HUB 고객 지원 챗봇입니다. 무엇을 도와드릴까요? 😊\n\n자주 묻는 질문: 예약, 결제, 쿠폰, 취소에 대해 물어보실 수 있습니다.';
    } else if (message.includes('도움') || message.includes('help') || message.includes('도와')) {
        return '다음과 같은 질문에 답변할 수 있습니다:\n\n📅 예약 방법\n💳 결제 방법\n🎟 쿠폰 사용 방법\n❌ 예약 취소 방법\n\n원하시는 내용을 입력해주세요!';
    } else {
        return '죄송합니다. 아직 그 질문에 대한 답변을 준비하지 못했습니다. 😅\n\n다음과 같은 질문에 답변할 수 있습니다:\n• 예약 방법\n• 결제 방법\n• 쿠폰 사용 방법\n• 예약 취소 방법\n\n또는 더 자세한 문의는 관리자에게 연락해주세요.';
    }
}

// 챗봇 메시지 전송
function sendChatbotMessage() {
    const input = document.getElementById('chatbot-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // 사용자 메시지 표시
    addChatMessage(message, true);
    input.value = '';
    
    // 챗봇 응답 (약간의 딜레이로 자연스럽게)
    setTimeout(() => {
        const response = getChatbotResponse(message);
        addChatMessage(response, false);
    }, 500);
}

// 챗봇 초기화
function initChatbot() {
    // 전송 버튼
    const sendBtn = document.getElementById('chatbot-send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatbotMessage);
    }
    
    // Enter 키로 전송
    const input = document.getElementById('chatbot-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatbotMessage();
            }
        });
    }
    
    // FAQ 버튼 클릭 이벤트 및 hover 효과
    document.querySelectorAll('.faq-button').forEach(btn => {
        // hover 효과
        btn.addEventListener('mouseenter', function() {
            this.style.background = '#667eea';
            this.style.color = '#ffffff';
            this.style.transform = 'translateX(4px)';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.background = '#f0f4ff';
            this.style.color = '#667eea';
            this.style.transform = 'translateX(0)';
        });
        
        // 클릭 이벤트
        btn.addEventListener('click', function() {
            const question = this.getAttribute('data-question');
            if (faqData[question]) {
                // 사용자 메시지로 표시
                addChatMessage(faqData[question].question, true);
                // 챗봇 응답
                setTimeout(() => {
                    addChatMessage(faqData[question].answer, false);
                }, 300);
            }
        });
    });
}

// 페이지 로드 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
} else {
    initChatbot();
}

