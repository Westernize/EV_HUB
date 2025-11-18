package com.example.ElectronicCar.config;

import com.example.ElectronicCar.entity.User;
import com.example.ElectronicCar.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class AdminInitializer {

    @Autowired
    private UserRepository userRepository;

    @PostConstruct
    public void init() {
        // admin 계정이 없으면 자동 생성
        Optional<User> adminUser = userRepository.findByUsername("admin");
        
        if (adminUser.isEmpty()) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword("1234");
            admin.setNickname("관리자");
            admin.setRole("ADMIN");
            admin.setKakaoId(null);
            
            userRepository.save(admin);
            System.out.println("✅ 관리자 계정이 생성되었습니다. (아이디: admin, 비밀번호: 1234)");
        } else {
            // admin 계정이 이미 있지만 역할이 ADMIN이 아니면 업데이트
            User existingAdmin = adminUser.get();
            if (!"ADMIN".equals(existingAdmin.getRole())) {
                existingAdmin.setRole("ADMIN");
                userRepository.save(existingAdmin);
                System.out.println("✅ 기존 admin 계정의 역할이 ADMIN으로 업데이트되었습니다.");
            }
        }
    }
}

