package com.example.ElectronicCar.repository;

import com.example.ElectronicCar.entity.Favorite;
import com.example.ElectronicCar.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    // ✅ 특정 유저의 즐겨찾기 목록 조회
    List<Favorite> findByUser(User user);

    // ✅ 중복 방지 (유저 + 장소 이름이 같으면 중복 처리)
    Optional<Favorite> findByUserAndPlaceName(User user, String placeName);
}

