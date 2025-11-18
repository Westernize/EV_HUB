package com.example.ElectronicCar.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "favorites")
@Data  // ✅ Getter/Setter 자동 생성
public class Favorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ✅ 사용자와 연결 (ManyToOne)
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String placeName;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;
}

