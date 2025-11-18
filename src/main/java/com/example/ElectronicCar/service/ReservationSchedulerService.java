package com.example.ElectronicCar.service;

import com.example.ElectronicCar.entity.Reservation;
import com.example.ElectronicCar.repository.ReservationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReservationSchedulerService {

    @Autowired
    private ReservationRepository reservationRepository;

    // ✅ 10분마다 실행하여 미결제 예약 중 10분이 지난 것들을 자동 취소
    @Scheduled(fixedRate = 60000) // 1분마다 체크
    public void cancelUnpaidReservations() {
        List<Reservation> unpaidReservations = reservationRepository.findByPaid(false);
        LocalDateTime now = LocalDateTime.now();
        
        for (Reservation reservation : unpaidReservations) {
            // 예약 생성 후 10분이 지났는지 확인
            if (reservation.getCreatedAt() != null) {
                LocalDateTime createdAt = reservation.getCreatedAt();
                LocalDateTime expireTime = createdAt.plusMinutes(10);
                
                if (now.isAfter(expireTime)) {
                    // 10분이 지났으면 예약 취소
                    reservationRepository.delete(reservation);
                    System.out.println("⏰ 예약 자동 취소: " + reservation.getId() + " (10분 경과, 미결제)");
                }
            }
        }
    }
}

