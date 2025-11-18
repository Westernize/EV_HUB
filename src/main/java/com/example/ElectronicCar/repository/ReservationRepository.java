package com.example.ElectronicCar.repository;

import com.example.ElectronicCar.entity.Reservation;
import com.example.ElectronicCar.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    // ✅ 특정 사용자(User 객체) 기준으로 예약 내역 조회
    List<Reservation> findByUser(User user);

    // ✅ username 기반으로 예약 내역 조회
    List<Reservation> findByUser_Username(String username);

    // ✅ 결제 중복 확인 (기존 기능 유지)
    boolean existsByPaymentId(String paymentId);

    // ✅ [추가] 결제 완료된 예약 개수 (Admin Dashboard에서 사용)
    long countByPaid(boolean paid);

    // ✅ [추가] 결제 완료된 예약 목록 조회 (Admin 결제 관리 화면에서 사용 가능)
    List<Reservation> findByPaid(boolean paid);
    List<Reservation> findByUserAndPaid(User user, boolean paid);

    // ✅ [추가] 스케줄러용: 미결제 예약 중 특정 시간 이전에 생성된 예약 조회
    List<Reservation> findByPaidFalseAndCreatedAtBefore(LocalDateTime dateTime);

}
