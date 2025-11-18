package com.example.ElectronicCar.controller;

import com.example.ElectronicCar.entity.User;
import com.example.ElectronicCar.entity.Coupon;
import com.example.ElectronicCar.entity.CouponType;
import com.example.ElectronicCar.repository.UserRepository;
import com.example.ElectronicCar.repository.CouponRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CouponRepository couponRepository; // ✅ 쿠폰 저장용 Repository 추가

    // ✅ 회원가입 (WELCOME 쿠폰 지급 포함)
    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody User user) {
        // 입력값 검증
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("아이디를 입력해주세요.");
        }
        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("비밀번호를 입력해주세요.");
        }
        if (user.getNickname() == null || user.getNickname().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("닉네임을 입력해주세요.");
        }
        
        // 중복 확인
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body("이미 존재하는 아이디입니다.");
        }

        // 일반 회원가입이므로 kakaoId는 null로 설정
        // 데이터베이스에서 NULL 허용이므로 명시적으로 null 설정
        user.setKakaoId(null);
        
        // 기본 권한 USER
        if (user.getRole() == null || user.getRole().isEmpty()) {
            user.setRole("USER");
        }

        // 사용자 저장
        userRepository.save(user);

        // ✅ 회원가입 시 웰컴 쿠폰 자동 지급
        Coupon welcomeCoupon = new Coupon();
        welcomeCoupon.setUser(user);
        welcomeCoupon.setType(CouponType.WELCOME);
        welcomeCoupon.setUsed(false);
        couponRepository.save(welcomeCoupon);

        return ResponseEntity.ok("회원가입 성공!  웰컴 쿠폰 1장이 지급되었습니다.");
    }

    // ✅ 로그인 (세션 저장 포함)
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody User user, HttpSession session) {
        Optional<User> found = userRepository.findByUsername(user.getUsername());

        if (found.isPresent() && found.get().getPassword().equals(user.getPassword())) {

            // ✅ 세션 저장 (로그인 사용자 유지)
            session.setAttribute("currentUser", found.get());
            System.out.println("✅ 로그인 성공 (세션 저장 완료): " + found.get().getUsername());

            return ResponseEntity.ok(found.get());
        }

        System.out.println("❌ 로그인 실패: " + user.getUsername());
        return ResponseEntity.status(401).body("아이디 또는 비밀번호가 잘못되었습니다.");
    }

    // ✅ 세션 확인 (현재 로그인한 사용자 정보 조회)
    @GetMapping("/check-session")
    public ResponseEntity<?> checkSession(HttpSession session) {
        User user = (User) session.getAttribute("currentUser");
        if (user != null) {
            return ResponseEntity.ok(user);
        }
        return ResponseEntity.ok(null); // 로그인하지 않은 경우 null 반환
    }

    // ✅ 로그아웃
    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok("로그아웃되었습니다.");
    }

    // ✅ 사용자 정보 업데이트 (닉네임)
    @PostMapping("/update")
    public ResponseEntity<?> updateUser(@RequestBody User user, HttpSession session) {
        User sessionUser = (User) session.getAttribute("currentUser");
        if (sessionUser == null) {
            return ResponseEntity.status(401).body("로그인이 필요합니다.");
        }

        Optional<User> userOpt = userRepository.findByUsername(sessionUser.getUsername());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("사용자 정보를 찾을 수 없습니다.");
        }

        User existingUser = userOpt.get();
        
        // 닉네임 업데이트
        if (user.getNickname() != null && !user.getNickname().isEmpty()) {
            existingUser.setNickname(user.getNickname());
        }

        userRepository.save(existingUser);
        
        // 세션 업데이트
        session.setAttribute("currentUser", existingUser);

        return ResponseEntity.ok(existingUser);
    }
}

