package com.example.ElectronicCar.controller;

import com.example.ElectronicCar.entity.Coupon;
import com.example.ElectronicCar.entity.Reservation;
import com.example.ElectronicCar.entity.User;
import com.example.ElectronicCar.repository.CouponRepository;
import com.example.ElectronicCar.repository.ReservationRepository;
import com.example.ElectronicCar.repository.UserRepository;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class KakaoReservationController {

    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final CouponRepository couponRepository;

    public KakaoReservationController(ReservationRepository reservationRepository,
                                      UserRepository userRepository,
                                      CouponRepository couponRepository) {
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.couponRepository = couponRepository;
    }

    // ✅ 1️⃣ 카카오 로그인 후 사용자 저장/업데이트
    @PostMapping("/users/save")
    public ResponseEntity<String> saveUser(@RequestBody UserDto dto) {
        Optional<User> existingUser = userRepository.findByKakaoId(dto.getKakaoId());

        if (existingUser.isPresent()) {
            User user = existingUser.get();
            user.setNickname(dto.getNickname());
            userRepository.save(user);
            return ResponseEntity.ok("기존 사용자 업데이트 완료");
        }

        User newUser = new User();
        newUser.setKakaoId(dto.getKakaoId());
        newUser.setNickname(dto.getNickname());
        newUser.setRole("USER");
        userRepository.save(newUser);

        return ResponseEntity.ok("새 사용자 등록 완료");
    }

    // ✅ 2️⃣ 충전소 예약 등록 (일반 로그인 사용자 또는 카카오 사용자)
    @PostMapping("/reservations/create")
    public ResponseEntity<String> createReservation(@RequestBody ReservationDto dto) {
        User user = null;
        
        // username으로 먼저 찾기 (일반 로그인 사용자)
        if (dto.getUsername() != null && !dto.getUsername().isEmpty()) {
            Optional<User> userOpt = userRepository.findByUsername(dto.getUsername());
            if (userOpt.isPresent()) {
                user = userOpt.get();
            }
        }
        
        // username으로 못 찾았으면 kakaoId로 찾기 (카카오 사용자)
        if (user == null && dto.getKakaoId() != null && !dto.getKakaoId().isEmpty()) {
            Optional<User> userOpt = userRepository.findByKakaoId(dto.getKakaoId());
            if (userOpt.isPresent()) {
                user = userOpt.get();
            }
        }
        
        if (user == null) {
            return ResponseEntity.badRequest().body("사용자를 찾을 수 없습니다.");
        }

        LocalTime reserveTime;
        try {
            String timeStr = dto.getReserveTime();
            // "HH:mm" 형식이면 "HH:mm:00"으로 변환
            if (timeStr != null && timeStr.length() == 5 && timeStr.matches("\\d{2}:\\d{2}")) {
                timeStr = timeStr + ":00";
            }
            reserveTime = LocalTime.parse(timeStr);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("예약 시간 형식이 올바르지 않습니다. (예: 17:30)");
        }

        LocalDate reserveDate;
        try {
            if (dto.getReserveDate() != null && !dto.getReserveDate().isEmpty()) {
                reserveDate = LocalDate.parse(dto.getReserveDate());
            } else {
                reserveDate = LocalDate.now();
            }
        } catch (Exception e) {
            reserveDate = LocalDate.now();
        }

        Reservation reservation = new Reservation();
        reservation.setUser(user);
        reservation.setPlaceName(dto.getPlaceName());
        reservation.setReserveTime(reserveTime);
        reservation.setReserveDate(reserveDate);
        reservation.setChgerId(dto.getChgerId());  // 충전기 ID 설정

        reservationRepository.save(reservation);

        return ResponseEntity.ok("예약이 완료되었습니다.");
    }

    // ✅ 3️⃣ 사용자 예약 목록 조회 (username 또는 kakaoId)
    @GetMapping("/reservations/user/{identifier}")
    public ResponseEntity<List<Reservation>> getUserReservations(@PathVariable String identifier) {
        User user = null;
        
        // username으로 먼저 찾기
        Optional<User> userOpt = userRepository.findByUsername(identifier);
        if (userOpt.isPresent()) {
            user = userOpt.get();
        } else {
            // username으로 못 찾았으면 kakaoId로 찾기
            userOpt = userRepository.findByKakaoId(identifier);
            if (userOpt.isPresent()) {
                user = userOpt.get();
            }
        }
        
        if (user == null) {
            return ResponseEntity.badRequest().body(List.of());
        }
        
        List<Reservation> reservations = reservationRepository.findByUser(user);
        return ResponseEntity.ok(reservations);
    }
    
    // ✅ 4️⃣ 세션 기반 예약 목록 조회 (현재 로그인한 사용자)
    @GetMapping("/reservations/my")
    public ResponseEntity<?> getMyReservations(jakarta.servlet.http.HttpSession session) {
        User user = (User) session.getAttribute("currentUser");
        if (user == null) {
            return ResponseEntity.status(401).body("로그인이 필요합니다.");
        }
        
        List<Reservation> reservations = reservationRepository.findByUser(user);
        return ResponseEntity.ok(reservations);
    }
    
    // ✅ 5️⃣ 예약 취소
    @DeleteMapping("/reservations/{id}")
    public ResponseEntity<String> cancelReservation(@PathVariable Long id, jakarta.servlet.http.HttpSession session) {
        User user = (User) session.getAttribute("currentUser");
        if (user == null) {
            return ResponseEntity.status(401).body("로그인이 필요합니다.");
        }
        
        Optional<Reservation> reservationOpt = reservationRepository.findById(id);
        if (reservationOpt.isEmpty()) {
            return ResponseEntity.status(404).body("예약을 찾을 수 없습니다.");
        }
        
        Reservation reservation = reservationOpt.get();
        
        // 본인의 예약인지 확인
        if (!reservation.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("본인의 예약만 취소할 수 있습니다.");
        }
        
        // 결제 완료된 예약도 취소 가능 (환불 처리)
        if (reservation.getPaid()) {
            String paymentId = reservation.getPaymentId();
            String couponMessage = "";
            
            // 쿠폰으로 결제한 경우 쿠폰 복구
            if (paymentId != null && (paymentId.contains("_COUPON_") || paymentId.startsWith("COUPON_"))) {
                try {
                    // paymentId 형식: "웰컴_COUPON_123" 또는 "무료_COUPON_123" 또는 "FREE_COUPON_123"
                    String[] parts = paymentId.split("_COUPON_");
                    if (parts.length == 2) {
                        Long couponId = Long.parseLong(parts[1]);
                        Optional<Coupon> couponOpt = couponRepository.findById(couponId);
                        if (couponOpt.isPresent()) {
                            Coupon coupon = couponOpt.get();
                            // 본인의 쿠폰인지 확인
                            if (coupon.getUser().getId().equals(user.getId())) {
                                coupon.setUsed(false);
                                couponRepository.save(coupon);
                                couponMessage = " 사용한 쿠폰이 복구되었습니다.";
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("쿠폰 복구 중 오류: " + e.getMessage());
                }
            }
            
            // 결제 완료된 예약 취소 시 환불 처리
            reservation.setPaid(false);
            reservation.setPaymentId(null);
            reservation.setAmount(0);
            reservationRepository.save(reservation);
            return ResponseEntity.ok("결제 완료된 예약이 취소되었습니다. 환불 처리가 완료되었습니다." + couponMessage);
        }
        
        // 미결제 예약은 그냥 삭제
        reservationRepository.delete(reservation);
        return ResponseEntity.ok("예약이 취소되었습니다.");
    }

    @Data
    public static class UserDto {
        private String kakaoId;
        private String nickname;
    }

    @Data
    public static class ReservationDto {
        private String kakaoId;
        private String username;  // 일반 로그인 사용자용
        private String placeName;
        private String reserveDate;  // 예약 날짜 추가
        private String reserveTime;
        private String chgerId;  // 충전기 ID 추가
    }
}

