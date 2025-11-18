package com.example.ElectronicCar.repository;

import com.example.ElectronicCar.model.StationInfo;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StationInfoRepository extends JpaRepository<StationInfo, String> {
}
