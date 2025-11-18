package com.example.ElectronicCar.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    // ✅ "/" → 자동으로 "/map"으로 리다이렉트
    @GetMapping("/")
    public String home() {
        return "redirect:/map";
    }

    // ✅ 개선된 지도(V2) 페이지 (MapController와 중복 방지)
    @GetMapping("/map/v2")
    public String mapPageV2() {
        return "main/map";
    }

    // ✅ 로그인 페이지
    @GetMapping("/login")
    public String loginPage() {
        return "login";
    }

    // ✅ 회원가입 페이지
    @GetMapping("/register")
    public String registerPage() {
        return "register";
    }

    // ✅ 내 예약 페이지 (리다이렉트만 - 실제 처리는 다른 컨트롤러에서)
    @GetMapping("/reservations/page")
    public String reservationPage() {
        return "redirect:/map?panel=reservations";
    }

    // ✅ 즐겨찾기 페이지 (리다이렉트만 - 실제 처리는 FavoriteController에서)
    @GetMapping("/favorites/page")
    public String favoritesPage() {
        return "redirect:/map?panel=favorites";
    }
}

