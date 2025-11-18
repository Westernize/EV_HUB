package com.example.ElectronicCar.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PaymentVerifyDto {
    private String impUid;     // 아임포트 결제 UID
    private String merchantUid; // 주문번호
    private String username;   // 사용자
    private String placeName;
    private String reserveDate;
    private String reserveTime;
    private Long reservationId; // 기존 예약 ID (결제 시)

    private Long couponId;

    public Long getCouponId() {
        return couponId;
    }
    public void setCouponId(Long couponId) {}
}

