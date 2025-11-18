package com.example.ElectronicCar.controller;

import com.example.ElectronicCar.entity.Coupon;
import com.example.ElectronicCar.entity.CouponType;
import com.example.ElectronicCar.entity.Reservation;
import com.example.ElectronicCar.entity.User;
import com.example.ElectronicCar.repository.CouponRepository;
import com.example.ElectronicCar.repository.ReservationRepository;
import com.example.ElectronicCar.repository.UserRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@Controller
@RequestMapping("/mypage")
public class MyPageController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private CouponRepository couponRepository;

    /**
     * ✅ 마이페이지 (예약 + 쿠폰 현황 표시)
     */
    @GetMapping
    public String myPage(Model model, HttpSession session) {
        User user = (User) session.getAttribute("currentUser");
        if (user == null) return "redirect:/login";

        // ✅ 예약 내역 조회
        List<Reservation> reservations = reservationRepository.findByUser_Username(user.getUsername());

        // ✅ 쿠폰 현황 (NORMAL / FREE / WELCOME)
        long normalCount = couponRepository.countByUserAndTypeAndUsedFalse(user, CouponType.NORMAL);
        long freeCount = couponRepository.countByUserAndTypeAndUsedFalse(user, CouponType.FREE);
        long welcomeCount = couponRepository.countByUserAndTypeAndUsedFalse(user, CouponType.WELCOME);

        // ✅ 전체 미사용 쿠폰 목록 (상세 테이블용)
        List<Coupon> coupons = couponRepository.findByUserAndUsedFalse(user);

        model.addAttribute("user", user);
        model.addAttribute("reservations", reservations);
        model.addAttribute("normalCount", normalCount);
        model.addAttribute("freeCount", freeCount);
        model.addAttribute("welcomeCount", welcomeCount);
        model.addAttribute("coupons", coupons);

        return "mypage";
    }

    /**
     * ✅ 비밀번호 변경 기능
     */
    @PostMapping("/password")
    @ResponseBody
    public ResponseEntity<String> changePassword(@RequestParam String currentPw,
                                                 @RequestParam String newPw,
                                                 HttpSession session) {

        User sessionUser = (User) session.getAttribute("currentUser");
        if (sessionUser == null) {
            return ResponseEntity.status(401).body("로그인이 필요합니다.");
        }

        Optional<User> userOpt = userRepository.findByUsername(sessionUser.getUsername());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("사용자 정보를 찾을 수 없습니다.");
        }

        User user = userOpt.get();

        if (!user.getPassword().equals(currentPw)) {
            return ResponseEntity.status(400).body("현재 비밀번호가 일치하지 않습니다.");
        }

        user.setPassword(newPw);
        userRepository.save(user);

        session.setAttribute("currentUser", user); //  세션 갱신

        return ResponseEntity.ok("비밀번호가 성공적으로 변경되었습니다.");
    }

    /**
     * ✅ NORMAL 쿠폰 10장 → FREE 쿠폰 1장 교환 기능
     */
    @PostMapping("/exchange-free")
    @ResponseBody
    public ResponseEntity<String> exchangeFreeCoupon(HttpSession session) {
        User sessionUser = (User) session.getAttribute("currentUser");
        if (sessionUser == null) {
            return ResponseEntity.status(401).body("⚠ 로그인이 필요합니다.");
        }

        Optional<User> userOpt = userRepository.findByUsername(sessionUser.getUsername());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(" 사용자 정보를 찾을 수 없습니다.");
        }

        User user = userOpt.get();
        List<Coupon> normalCoupons = couponRepository.findByUserAndTypeAndUsedFalse(user, CouponType.NORMAL);

        // ✅ NORMAL 쿠폰 개수 확인
        if (normalCoupons.size() < 10) {
            return ResponseEntity.badRequest().body(" NORMAL 쿠폰이 10장 이상 필요합니다.");
        }

        // ✅ NORMAL 쿠폰 10장 사용 처리
        for (int i = 0; i < 10; i++) {
            Coupon c = normalCoupons.get(i);
            c.setUsed(true);
            couponRepository.save(c);
        }

        // ✅ FREE 쿠폰 1장 발급
        Coupon freeCoupon = new Coupon();
        freeCoupon.setUser(user);
        freeCoupon.setType(CouponType.FREE);
        freeCoupon.setUsed(false);
        couponRepository.save(freeCoupon);

        return ResponseEntity.ok(" FREE 쿠폰 1장이 발급되었습니다!");
    }
}

