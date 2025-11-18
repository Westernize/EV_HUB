package com.example.ElectronicCar.controller;

import com.example.ElectronicCar.dto.FavoriteDto;
import com.example.ElectronicCar.entity.Favorite;
import com.example.ElectronicCar.entity.User;
import com.example.ElectronicCar.repository.FavoriteRepository;
import com.example.ElectronicCar.repository.UserRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/favorites")
public class FavoriteController {

    private final FavoriteRepository favoriteRepository;
    private final UserRepository userRepository;

    public FavoriteController(FavoriteRepository favoriteRepository, UserRepository userRepository) {
        this.favoriteRepository = favoriteRepository;
        this.userRepository = userRepository;
    }

    // ✅ 즐겨찾기 추가
    @PostMapping("/add")
    public String addFavorite(@RequestBody FavoriteDto dto) {
        System.out.println("📥 즐겨찾기 추가 요청: " + dto);
        
        if (dto.getUsername() == null || dto.getUsername().isEmpty()) {
            return "❌ 사용자 정보가 없습니다.";
        }
        
        User user = userRepository.findByUsername(dto.getUsername()).orElse(null);
        if (user == null) {
            System.err.println("❌ 사용자를 찾을 수 없음: " + dto.getUsername());
            return "❌ 사용자를 찾을 수 없습니다.";
        }

        // 중복 방지
        if (favoriteRepository.findByUserAndPlaceName(user, dto.getPlaceName()).isPresent()) {
            return "⚠ 이미 즐겨찾기한 충전소입니다.";
        }

        Favorite fav = new Favorite();
        fav.setUser(user);
        fav.setPlaceName(dto.getPlaceName());
        fav.setAddress(dto.getAddress());
        fav.setLat(dto.getLat());
        fav.setLng(dto.getLng());

        favoriteRepository.save(fav);
        System.out.println("✅ 즐겨찾기 추가 완료: " + fav.getPlaceName());
        return "✅ 즐겨찾기에 추가되었습니다!";
    }

    // ✅ 즐겨찾기 리스트 조회
    @GetMapping("/user/{username}")
    public List<Favorite> getFavorites(@PathVariable String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException(" 사용자 없음"));
        return favoriteRepository.findByUser(user);
    }

    // ✅ 즐겨찾기 삭제
    @DeleteMapping("/{id}")
    public String deleteFavorite(@PathVariable Long id) {
        if (!favoriteRepository.existsById(id)) {
            return " 즐겨찾기가 존재하지 않습니다.";
        }
        favoriteRepository.deleteById(id);
        return "🗑 즐겨찾기 삭제 완료!";
    }
}

