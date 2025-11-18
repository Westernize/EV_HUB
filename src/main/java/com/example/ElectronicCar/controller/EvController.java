package com.example.ElectronicCar.controller;

import com.example.ElectronicCar.service.EvService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/ev")
@CrossOrigin(origins = "*")
public class EvController {

    private final EvService evService;

    public EvController(EvService evService) {
        this.evService = evService;
    }

    @GetMapping("/all")
    public ResponseEntity<List<Map<String, Object>>> getAllStations() throws IOException {
        // 캐시 헤더 추가 (5분간 캐시) - 무한히 빠르게!
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES))
                .body(evService.loadAllStations());
    }

    @GetMapping("/hourly-usage/{stationId}")
    public List<Map<String, Object>> getHourlyUsage(
            @PathVariable String stationId,
            @RequestParam(required = false, defaultValue = "") String date) {

        // 날짜가 없으면 오늘 날짜 사용
        if (date == null || date.isEmpty()) {
            date = java.time.LocalDate.now().toString();
        }

        return evService.getHourlyUsage(stationId, date);
    }

    @GetMapping("/clusters")
    public ResponseEntity<List<Map<String, Object>>> getClusters(
            @RequestParam java.math.BigDecimal latitude,
            @RequestParam java.math.BigDecimal longitude,
            @RequestParam java.math.BigDecimal latitudeDelta,
            @RequestParam java.math.BigDecimal longitudeDelta,
            @RequestParam(defaultValue = "10") int latitudeDivisionSize,
            @RequestParam(defaultValue = "10") int longitudeDivisionSize) throws IOException {
        // 캐시 헤더 추가 (1분간 캐시) - 무한히 빠르게!
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.MINUTES))
                .body(evService.getClusters(latitude, longitude, latitudeDelta, longitudeDelta, latitudeDivisionSize, longitudeDivisionSize));
    }

    @GetMapping("/regions")
    public ResponseEntity<List<Map<String, Object>>> getRegions() throws IOException {
        // 캐시 헤더 추가 (5분간 캐시) - 무한히 빠르게!
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES))
                .body(evService.getRegions());
    }
}
