package com.example.ElectronicCar.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;

@Entity
@Table(name = "reservations")
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "place_name", nullable = false)
    private String placeName;

    @Column(name = "reserve_date", nullable = false)
    private LocalDate reserveDate;

    @Column(name = "reserve_time", nullable = false)
    private LocalTime reserveTime;

    @Column(name = "chger_id")
    private String chgerId;  // 충전기 ID

    // ✅ 결제 정보
    @Column(name = "payment_id")
    private String paymentId;     // 아임포트 결제번호 (imp_uid)

    @Column(name = "paid", nullable = false)
    private Boolean paid = false; // true면 결제 완료

    // ✅ ⭐ 추가: 결제 금액 (환불/매출 통계 위해 필수)
    @Column(name = "amount", nullable = false)
    private Integer amount = 100; // 기본값 100원 (필요 시 변경 가능)

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Reservation() {}

    // ✅ Getter / Setter
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getPlaceName() { return placeName; }
    public void setPlaceName(String placeName) { this.placeName = placeName; }

    public LocalDate getReserveDate() { return reserveDate; }
    public void setReserveDate(LocalDate reserveDate) { this.reserveDate = reserveDate; }

    public LocalTime getReserveTime() { return reserveTime; }
    public void setReserveTime(LocalTime reserveTime) { this.reserveTime = reserveTime; }

    public String getPaymentId() { return paymentId; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId; }

    public Boolean getPaid() { return paid; }
    public void setPaid(Boolean paid) { this.paid = paid; }

    public Integer getAmount() { return amount; }
    public void setAmount(Integer amount) { this.amount = amount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getChgerId() { return chgerId; }
    public void setChgerId(String chgerId) { this.chgerId = chgerId; }
}
