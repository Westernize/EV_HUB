package com.example.ElectronicCar.repository;

import com.example.ElectronicCar.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username); // ✅ 로그인용 username 기반 검색
    Optional<User> findByKakaoId(String kakaoId);   // ✅ 카카오 로그인 사용자 검색
}
