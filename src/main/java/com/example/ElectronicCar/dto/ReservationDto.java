package com.example.ElectronicCar.dto;

import lombok.Data;

@Data
public class ReservationDto {
    private String kakaoId;
    private String placeName;
    private String reserveTime; // "17:30" 문자열
}
