package com.example.ElectronicCar.controller;



import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class CouponPageController {

    // ✅ "/coupons" 주소로 들어오면 coupons.html 보여주기
    @GetMapping("/coupons")
    public String showCouponsPage() {
        return "redirect:/map?panel=coupons";
    }
}

