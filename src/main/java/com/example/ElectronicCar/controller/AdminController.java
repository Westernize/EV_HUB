package com.example.ElectronicCar.controller;

import com.example.ElectronicCar.entity.Reservation;
import com.example.ElectronicCar.entity.User;
import com.example.ElectronicCar.repository.ReservationRepository;
import com.example.ElectronicCar.repository.UserRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Controller
@RequestMapping("/admin")
public class AdminController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ReservationRepository reservationRepository;

    // ✅ 관리자 권한 확인 헬퍼 메서드
    private boolean isAdmin(HttpSession session) {
        User user = (User) session.getAttribute("currentUser");
        return user != null && "ADMIN".equals(user.getRole());
    }

    // ✅ 관리자 대시보드 메인 페이지 (View)
    @GetMapping("/dashboard")
    public String dashboard() {
        return "admin/dashboard";
    }

    // ✅ 1. 회원 수 조회
    @GetMapping("/stats/users/count")
    @ResponseBody
    public ResponseEntity<?> getUserCount(HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        long totalUsers = userRepository.count();
        long adminUsers = userRepository.findAll().stream()
                .filter(u -> "ADMIN".equals(u.getRole()))
                .count();
        long regularUsers = totalUsers - adminUsers;

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("adminUsers", adminUsers);
        stats.put("regularUsers", regularUsers);

        return ResponseEntity.ok(stats);
    }

    // ✅ 2. 회원 목록 조회
    @GetMapping("/users")
    @ResponseBody
    public ResponseEntity<?> getAllUsers(HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(users);
    }

    // ✅ 3. 회원 정보 수정
    @PutMapping("/users/{id}")
    @ResponseBody
    public ResponseEntity<?> updateUser(
            @PathVariable Long id,
            @RequestBody Map<String, String> updateData,
            HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("사용자를 찾을 수 없습니다.");
        }

        User user = userOpt.get();
        
        // 닉네임 수정
        if (updateData.containsKey("nickname")) {
            user.setNickname(updateData.get("nickname"));
        }
        
        // 비밀번호 수정 (비밀번호가 제공된 경우에만)
        if (updateData.containsKey("password") && !updateData.get("password").isEmpty()) {
            user.setPassword(updateData.get("password"));
        }
        
        // 역할 수정 (ADMIN만 가능)
        if (updateData.containsKey("role")) {
            String newRole = updateData.get("role");
            if ("USER".equals(newRole) || "ADMIN".equals(newRole)) {
                user.setRole(newRole);
            }
        }

        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

    // ✅ 4. 회원 삭제
    @DeleteMapping("/users/{id}")
    @ResponseBody
    public ResponseEntity<?> deleteUser(@PathVariable Long id, HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("사용자를 찾을 수 없습니다.");
        }

        User user = userOpt.get();
        
        // 자기 자신은 삭제 불가
        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser != null && currentUser.getId().equals(id)) {
            return ResponseEntity.status(400).body("자기 자신은 삭제할 수 없습니다.");
        }

        userRepository.delete(user);
        return ResponseEntity.ok("회원이 삭제되었습니다.");
    }

    // ✅ 5. 예약 내역 조회 (전체)
    @GetMapping("/reservations")
    @ResponseBody
    public ResponseEntity<?> getAllReservations(HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        List<Reservation> reservations = reservationRepository.findAll();
        return ResponseEntity.ok(reservations);
    }

    // ✅ 6. 예약 통계
    @GetMapping("/stats/reservations")
    @ResponseBody
    public ResponseEntity<?> getReservationStats(HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        long totalReservations = reservationRepository.count();
        long paidReservations = reservationRepository.countByPaid(true);
        long unpaidReservations = totalReservations - paidReservations;

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalReservations", totalReservations);
        stats.put("paidReservations", paidReservations);
        stats.put("unpaidReservations", unpaidReservations);

        return ResponseEntity.ok(stats);
    }

    // ✅ 7. 특정 회원의 예약 내역 조회
    @GetMapping("/users/{id}/reservations")
    @ResponseBody
    public ResponseEntity<?> getUserReservations(@PathVariable Long id, HttpSession session) {
        if (!isAdmin(session)) {
            return ResponseEntity.status(403).body("관리자 권한이 필요합니다.");
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("사용자를 찾을 수 없습니다.");
        }

        List<Reservation> reservations = reservationRepository.findByUser(userOpt.get());
        return ResponseEntity.ok(reservations);
    }
}
