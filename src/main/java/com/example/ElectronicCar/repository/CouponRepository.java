package com.example.ElectronicCar.repository;

import com.example.ElectronicCar.entity.Coupon;
import com.example.ElectronicCar.entity.CouponType;
import com.example.ElectronicCar.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CouponRepository extends JpaRepository<Coupon, Long> {

    // ✅ 1️⃣ 사용자별 전체 쿠폰 목록
    List<Coupon> findByUser(User user);

    // ✅ 2️⃣ 미사용 쿠폰 목록
    List<Coupon> findByUserAndUsedFalse(User user);

    // ✅ 3️⃣ 사용된 쿠폰 목록 (복원 시 필요)
    List<Coupon> findByUserAndUsedTrue(User user);

    // ✅ 4️⃣ 특정 타입(NORMAL/FREE/WELCOME)의 미사용 쿠폰 목록
    List<Coupon> findByUserAndTypeAndUsedFalse(User user, CouponType type);

    // ✅ 5️⃣ 특정 타입의 미사용 쿠폰 개수 (예: NORMAL 10장 모으면 FREE로 교환)
    long countByUserAndTypeAndUsedFalse(User user, CouponType type);
}

