package com.example.ElectronicCar.controller;

import com.example.ElectronicCar.dto.PaymentVerifyDto;
import com.example.ElectronicCar.entity.Coupon;
import com.example.ElectronicCar.entity.CouponType;
import com.example.ElectronicCar.entity.Reservation;
import com.example.ElectronicCar.entity.User;
import com.example.ElectronicCar.repository.CouponRepository;
import com.example.ElectronicCar.repository.ReservationRepository;
import com.example.ElectronicCar.repository.UserRepository;
import com.example.ElectronicCar.service.PaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/payments")
public class PaymentController {

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private CouponRepository couponRepository;

    // ⭐ 프론트에 전달할 가맹점 식별코드 (imp로 시작하는 값)
    @Value("${iamport.store_code:}")
    private String iamportStoreCode;

    // ⭐ 서버 검증용 REST API KEY
    @Value("${iamport.api_key}")
    private String iamportRestApiKey;

    // ⭐ 서버 검증용 REST API SECRET
    @Value("${iamport.api_secret}")
    private String iamportRestApiSecret;


    // ⭐ 프론트에서 IMP.init()에 사용할 가맹점 식별코드 전달
    @GetMapping("/iamport-key")
    public ResponseEntity<Map<String, String>> getIamportKey() {
        Map<String, String> response = new HashMap<>();
        response.put("apiKey", iamportStoreCode);  // ← imp12345678 반환됨
        return ResponseEntity.ok(response);
    }


    // ⭐ 결제 검증 및 예약 처리
    @PostMapping("/verify")
    public ResponseEntity<String> verifyPayment(@RequestBody PaymentVerifyDto dto) {

        System.out.println("📥 결제 요청: " + dto);

        // 1️⃣ 사용자 체크
        User user = userRepository.findByUsername(dto.getUsername()).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body("❌ 사용자 없음");
        }

        // ⭐ 쿠폰 결제 처리
        if ("COUPON_PAYMENT".equals(dto.getImpUid())) {
            Coupon coupon = null;
            String couponTypeName = "";
            
            // 쿠폰 ID가 있으면 해당 쿠폰 사용
            if (dto.getCouponId() != null) {
                coupon = couponRepository.findById(dto.getCouponId()).orElse(null);
                if (coupon == null || coupon.isUsed() || !coupon.getUser().getId().equals(user.getId())) {
                    return ResponseEntity.badRequest().body("⚠ 사용할 수 없는 쿠폰입니다.");
                }
                if (coupon.getType() == CouponType.WELCOME) {
                    couponTypeName = "웰컴";
                } else if (coupon.getType() == CouponType.FREE) {
                    couponTypeName = "무료";
                } else {
                    return ResponseEntity.badRequest().body("⚠ 웰컴 쿠폰 또는 무료 쿠폰만 사용할 수 있습니다.");
                }
            } else {
                // 쿠폰 ID가 없으면 웰컴 쿠폰 우선, 없으면 무료 쿠폰
                List<Coupon> welcomeCoupons = couponRepository.findByUserAndTypeAndUsedFalse(user, CouponType.WELCOME);
                if (!welcomeCoupons.isEmpty()) {
                    coupon = welcomeCoupons.get(0);
                    couponTypeName = "웰컴";
                } else {
                    List<Coupon> freeCoupons = couponRepository.findByUserAndTypeAndUsedFalse(user, CouponType.FREE);
                    if (!freeCoupons.isEmpty()) {
                        coupon = freeCoupons.get(0);
                        couponTypeName = "무료";
                    } else {
                        return ResponseEntity.badRequest().body("⚠ 사용 가능한 쿠폰이 없습니다.");
                    }
                }
            }

            coupon.setUsed(true);
            couponRepository.save(coupon);

            Reservation reservation;
            if (dto.getReservationId() != null) {
                reservation = reservationRepository.findById(dto.getReservationId()).orElse(null);
                if (reservation == null) {
                    return ResponseEntity.badRequest().body("❌ 예약을 찾을 수 없습니다.");
                }
                if (!reservation.getUser().getId().equals(user.getId())) {
                    return ResponseEntity.status(403).body("❌ 본인의 예약만 결제할 수 있습니다.");
                }
                if (reservation.getPaid()) {
                    return ResponseEntity.badRequest().body("⚠ 이미 결제 완료된 예약입니다.");
                }
            } else {
                reservation = new Reservation();
                reservation.setUser(user);
                reservation.setPlaceName(dto.getPlaceName());
                reservation.setReserveDate(LocalDate.parse(dto.getReserveDate()));
                reservation.setReserveTime(LocalTime.parse(dto.getReserveTime()));
            }
            
            reservation.setPaymentId(couponTypeName + "_COUPON_" + coupon.getId());
            reservation.setPaid(true);
            reservation.setAmount(0);
            reservationRepository.save(reservation);

            return ResponseEntity.ok("🎟 " + couponTypeName + " 쿠폰으로 예약 완료!");
        }


        // ⭐ 일반 결제 검증 → 서버에서 포트원 REST API 호출
        boolean valid = paymentService.verifyPaymentWithIamport(dto.getImpUid(), dto.getMerchantUid());
        if (!valid) {
            return ResponseEntity.badRequest().body("❌ 결제 검증 실패");
        }

        int paymentAmount = 100;


        // 2️⃣ 쿠폰 사용 시 처리
        if (dto.getCouponId() != null) {

            Coupon coupon = couponRepository.findById(dto.getCouponId()).orElse(null);

            if (coupon != null && !coupon.isUsed()) {

                coupon.setUsed(true);
                couponRepository.save(coupon);

                if (coupon.getType() == CouponType.FREE || coupon.getType() == CouponType.WELCOME) {
                    paymentAmount = 0;
                }
            }
        }


        // 3️⃣ 기존 예약 or 신규 예약 처리
        Reservation reservation;

        if (dto.getReservationId() != null) {
            reservation = reservationRepository.findById(dto.getReservationId()).orElse(null);
            if (reservation == null) {
                return ResponseEntity.badRequest().body("❌ 예약을 찾을 수 없습니다.");
            }
            if (!reservation.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body("❌ 본인의 예약만 결제할 수 있습니다.");
            }
            if (reservation.getPaid()) {
                return ResponseEntity.badRequest().body("⚠ 이미 결제 완료된 예약입니다.");
            }

        } else {
            reservation = new Reservation();
            reservation.setUser(user);
            reservation.setPlaceName(dto.getPlaceName());
            reservation.setReserveDate(LocalDate.parse(dto.getReserveDate()));
            reservation.setReserveTime(LocalTime.parse(dto.getReserveTime()));
        }

        // 4️⃣ 결제 완료 처리
        reservation.setPaymentId(dto.getImpUid());
        reservation.setPaid(true);
        reservation.setAmount(paymentAmount);
        reservationRepository.save(reservation);


        // ⭐ NORMAL 쿠폰 1장 지급
        Coupon normalCoupon = new Coupon();
        normalCoupon.setUser(user);
        normalCoupon.setType(CouponType.NORMAL);
        normalCoupon.setUsed(false);
        couponRepository.save(normalCoupon);


        // ⭐ NORMAL 쿠폰 5장 이상 → FREE 쿠폰 지급
        long normalCount = couponRepository.countByUserAndTypeAndUsedFalse(user, CouponType.NORMAL);

        if (normalCount >= 5) {

            Coupon freeCoupon = new Coupon();
            freeCoupon.setUser(user);
            freeCoupon.setType(CouponType.FREE);
            freeCoupon.setUsed(false);
            couponRepository.save(freeCoupon);

            List<Coupon> normals = couponRepository.findByUserAndTypeAndUsedFalse(user, CouponType.NORMAL);
            int used = 0;

            for (Coupon c : normals) {
                if (used < 5) {
                    c.setUsed(true);
                    couponRepository.save(c);
                    used++;
                }
            }
        }

        return ResponseEntity.ok("✅ 결제 및 예약 성공! 쿠폰이 지급되었습니다.");
    }
}
