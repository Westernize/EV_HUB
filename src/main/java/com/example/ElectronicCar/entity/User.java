package com.example.ElectronicCar.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.DynamicInsert;

@Entity
@Table(name = "users")
@DynamicInsert  // null 필드는 INSERT 문에서 제외
@Data   // ✅ 자동으로 getter/setter/toString 생성
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = true, unique = true)
    private String username; // 로그인용 ID (일반 회원)

    @Column(nullable = true)
    private String password; // 로그인 비밀번호 (소셜 로그인 사용자는 null 허용)

    @Column(name = "kakao_id", nullable = true, unique = true, insertable = true, updatable = true)
    private String kakaoId; // 카카오 로그인 식별자

    @Column(nullable = false)
    private String nickname; // 사용자 이름 또는 표시명

    @Column(nullable = false)
    private String role = "USER";
}
