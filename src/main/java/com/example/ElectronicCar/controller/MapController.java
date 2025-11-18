package com.example.ElectronicCar.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MapController {

    @GetMapping("/map")
    public String showMap(Model model) {
        // ✅ 카카오맵 JavaScript 키
        model.addAttribute("kakaoKey", "52c37dc8679ac1f1f4eddf0e79ce88c7");
        return "main/map"; // ✅ templates/main/map.html 렌더링
    }
}
