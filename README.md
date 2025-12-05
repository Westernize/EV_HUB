[EV HUB] 전기차 충전소 예약 시스템
<p align="center"> <img src="docs/logo.png" width="800" alt="EV HUB Logo"/> </p>
📌 유튜브 시연 영상 보기
<br>
🌟 프로젝트 소개

EV HUB는 전기차 충전소 예약·결제·쿠폰·즐겨찾기 기능을 통합한 플랫폼입니다.

사용자 증가에도 불구하고 대부분 충전소는 선착순 운영으로 효율성이 떨어지는 문제를 해결합니다.

회원 정보, 예약 내역, 결제 정보, 즐겨찾기 데이터는 MySQL DB와 연동하여 실시간 관리됩니다.

Java Spring Boot와 Thymeleaf를 활용하여 웹 기반 UI와 지도 기능을 구현했습니다.

<br>
목차

개발 환경

사용 기술 스택

프로젝트 구조

개발 기간 및 작업 관리

개발 중점 사항

팀원 역할 분담

기능 시연

추후 고려 사항

프로젝트 회고

<br>
1. 🛠️ 개발 환경

IDE: IntelliJ IDEA

Backend: Java 21, Spring Boot 3.5.7

Frontend: Thymeleaf, JavaScript, Kakao Map API

Database: MySQL 8.3.0

결제 시스템: Iamport (카카오페이·토스)

버전 관리: GitHub (EV_HUB Repository
)

협업 도구: Discord

<br>
2. 🔌 사용 기술 스택
Backend

Spring Boot 기반 REST API 구축

JPA 활용하여 DB 연동 및 CRUD 처리

결제 검증 및 예약 로직 처리

Frontend

Thymeleaf 템플릿으로 동적 페이지 구현

Kakao Map API를 활용한 충전소 지도 표시

JavaScript로 UI 상호작용 및 예약 폼 처리

Database

MySQL을 활용하여 사용자, 예약, 쿠폰, 즐겨찾기 데이터 관리

User 중심 테이블 관계 설계 (User ↔ Reservation, Coupon, Favorite 1:N)

Payment

Iamport 연동: 카드, 쿠폰 결제

서버 측 중복 결제 방지 및 상태 검증

3. 🗂️ 프로젝트 구조
├── README.md
├── src
│   ├── main
│   │   ├── java -> 백엔드 컨트롤러, 서비스, 리포지토리
│   │   └── resources -> Thymeleaf, application.yml
│   └── test -> 테스트 코드
├── docs
│   ├── logo.png
│   ├── main.png
│   ├── ERD.png
│   ├── signup.png
│   ├── login.png
│   ├── map.png
│   ├── reservation.png
│   ├── payment.png
│   ├── favorite.png
│   ├── admin_dashboard.png
│   └── admin_manage.png
└── build.gradle

4. 📆 개발 기간 및 작업 관리
개발 기간 (2025-09-01 ~ 2025-09-28)

프로젝트 기획 : 2025-09-01 ~ 2025-09-07

프로젝트 분석 : 2025-09-08 ~ 2025-09-12

백엔드 개발 : 2025-09-13 ~ 2025-09-20

프론트엔드 및 UI 개발 : 2025-09-21 ~ 2025-09-25

통합 테스트 및 발표 준비 : 2025-09-26 ~ 2025-09-28

<br>
회의와 버전 및 형상 관리

GitHub를 활용하여 소스 코드의 버전 관리를 체계적으로 수행

팀원 간 코드 병합과 기능 연동에 집중

5. 🎯 개발 중점 사항

실시간 충전소 상태 표시 및 예약 데이터 동기화

사용자 친화적인 예약 흐름 구현

결제 보안 및 쿠폰 시스템 안정성 확보

지도 기반 UI로 위치 검색 및 필터링 기능 구현

6. 👥 팀원 역할 분담

이희찬 (Full Stack)

사용자 인증, 지도, 예약, 결제, UI 개발

김찬형 (Full Stack)

쿠폰 시스템, 관리자 페이지, DB 설계, 결제 검증

7. ▶️ 기능 시연
📌 유튜브 시연 영상 보기
<div align="center"> ### 사용자 인증 </div> <table> <tr> <td align="center"> <img src="docs/signup.png" width="400px"><br> <sub>회원가입</sub> </td> <td align="center"> <img src="docs/login.png" width="400px"><br> <sub>로그인</sub> </td> </tr> </table> <div align="center"> ### 충전소 지도 & 예약 </div> <table> <tr> <td align="center"> <img src="docs/map.png" width="400px"><br> <sub>충전소 지도</sub> </td> <td align="center"> <img src="docs/reservation.png" width="400px"><br> <sub>충전소 예약</sub> </td> </tr> </table> <div align="center"> ### 결제 & 즐겨찾기 </div> <table> <tr> <td align="center"> <img src="docs/payment.png" width="400px"><br> <sub>결제</sub> </td> <td align="center"> <img src="docs/favorite.png" width="400px"><br> <sub>즐겨찾기</sub> </td> </tr> </table> <div align="center"> ### 관리자 페이지 </div> <table> <tr> <td align="center"> <img src="docs/admin_dashboard.png" width="400px"><br> <sub>회원/예약 통계</sub> </td> <td align="center"> <img src="docs/admin_manage.png" width="400px"><br> <sub>회원/예약 관리</sub> </td> </tr> </table>
8. 📌 추후 고려 사항

예약 가능 시간 시각화 및 알림 기능

AI 기반 충전소 추천 시스템

경로 최적화 네비게이션

리뷰/평점 기능 추가

결제 보안 강화 (비밀번호 암호화, SQL Injection 방지)

9. 🤔 프로젝트 회고

교과목 연계: 객체지향 프로그래밍, 데이터베이스, 웹 프로그래밍 지식을 통합하여 실습

클라우드 서버 활용: GCP 기반 DB로 동시 사용자 환경 테스트 가능

협업 경험: GitHub를 통한 코드 병합, 기능 연동 과정에서 팀 협업 역량 강화

🔗 GitHub Repository

https://github.com/Westernize/EV_HUB
