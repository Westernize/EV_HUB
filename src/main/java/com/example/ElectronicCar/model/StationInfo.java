package com.example.ElectronicCar.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;   // ✅ 이거 추가!
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "station_info")   // ✅ 테이블 이름 명시 (자동 매핑 문제 방지)
@Getter
@Setter
@NoArgsConstructor
public class StationInfo {

    @Id
    private String statId;

    private String name;
    private String addr;
    private String operator;
    private String chargerType;
    private String status;
    private double lat;
    private double lng;
}
