package com.example.ElectronicCar.dto;

public class FavoriteDto {
    private String username;  // 사용자 ID
    private String placeName; // 충전소 이름
    private String address;   // 충전소 주소 (선택)
    private Double lat;       // 위도 (선택)
    private Double lng;       // 경도 (선택)

    // ✅ 기본 생성자
    public FavoriteDto() {}

    // ✅ Getter / Setter
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPlaceName() { return placeName; }
    public void setPlaceName(String placeName) { this.placeName = placeName; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public Double getLat() { return lat; }
    public void setLat(Double lat) { this.lat = lat; }

    public Double getLng() { return lng; }
    public void setLng(Double lng) { this.lng = lng; }
}

