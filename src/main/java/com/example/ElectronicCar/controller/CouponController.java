package com.example.ElectronicCar.controller;

import com.example.ElectronicCar.entity.Coupon;
import com.example.ElectronicCar.entity.CouponType;
import com.example.ElectronicCar.entity.User;
import com.example.ElectronicCar.repository.CouponRepository;
import com.example.ElectronicCar.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/coupons")
public class CouponController {

    @Autowired
    private CouponRepository couponRepository;
    @Autowired
    private UserRepository userRepository;

    // ✅ 사용자 쿠폰 목록 조회
    @GetMapping("/{username}")
    public ResponseEntity<?> getUserCoupons(@PathVariable String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ResponseEntity.badRequest().body("❌ 사용자 없음");

        List<Coupon> coupons = couponRepository.findByUserAndUsedFalse(user); // ✅ 미사용만
        return ResponseEntity.ok(coupons);
    }

    // ✅ NORMAL → FREE 쿠폰 교환
    @PostMapping("/exchange/{username}")
    public ResponseEntity<String> exchangeToFree(@PathVariable String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ResponseEntity.badRequest().body("❌ 사용자 없음");

        List<Coupon> normalCoupons = couponRepository.findByUserAndTypeAndUsedFalse(user, CouponType.NORMAL);

        if (normalCoupons.size() < 5) {
            return ResponseEntity.badRequest().body("⚠ NORMAL 쿠폰이 5장 이상 필요합니다.");
        }

        // ✅ 10장 사용 처리
        for (int i = 0; i < 5; i++) {
            Coupon c = normalCoupons.get(i);
            c.setUsed(true);
            couponRepository.save(c);
        }

        // ✅ FREE 쿠폰 발급
        Coupon free = new Coupon();
        free.setUser(user);
        free.setType(CouponType.FREE);
        free.setUsed(false);
        couponRepository.save(free);

        return ResponseEntity.ok("🎉 FREE 쿠폰이 발급되었습니다!");
    }
}

