package com.example.ElectronicCar.service;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;

@Service
public class PaymentService {

    // ⭐ 서버 검증용 REST API KEY
    @Value("${iamport.api_key}")
    private String restApiKey;

    // ⭐ 서버 검증용 REST API SECRET
    @Value("${iamport.api_secret}")
    private String restApiSecret;


    /**
     * ⭐ 1) 포트원 토큰 발급
     */
    private String getAccessToken() {
        try {
            URL url = new URL("https://api.iamport.kr/users/getToken");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            // 요청 JSON
            JsonObject json = new JsonObject();
            json.addProperty("imp_key", restApiKey);
            json.addProperty("imp_secret", restApiSecret);

            // JSON 전송
            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.toString().getBytes());
            }

            int status = conn.getResponseCode();
            if (status != 200) {
                System.err.println("❌ [토큰 발급 실패] HTTP 코드 = " + status);

                if (conn.getErrorStream() != null) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                    System.err.println("오류 응답: " + br.lines().reduce("", (a, b) -> a + b));
                }
                return null;
            }

            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            JsonObject root = JsonParser.parseReader(br).getAsJsonObject();

            if (!root.has("response") || !root.get("response").isJsonObject()) {
                System.err.println("❌ [토큰 발급 실패] 응답 포맷 오류: " + root);
                return null;
            }

            String token = root.getAsJsonObject("response").get("access_token").getAsString();
            System.out.println("✅ 포트원 토큰 발급 성공");
            return token;

        } catch (Exception e) {
            System.err.println("❌ [토큰 발급 예외] " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }


    /**
     * ⭐ 2) imp_uid 기반 결제 검증
     */
    public boolean verifyPaymentWithIamport(String impUid, String merchantUid) {
        try {
            String token = getAccessToken();
            if (token == null) {
                System.err.println("❌ 토큰 발급 실패 → 결제 검증 불가");
                return false;
            }

            URL url = new URL("https://api.iamport.kr/payments/" + impUid);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);

            int status = conn.getResponseCode();
            if (status != 200) {
                System.err.println("❌ [결제 검증 실패] HTTP 코드 = " + status);

                if (conn.getErrorStream() != null) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                    System.err.println("오류 응답: " + br.lines().reduce("", (a, b) -> a + b));
                }
                return false;
            }

            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            JsonObject root = JsonParser.parseReader(br).getAsJsonObject();

            if (!root.has("response") || !root.get("response").isJsonObject()) {
                System.err.println("❌ [결제 검증 오류] 응답 구조 이상: " + root);
                return false;
            }

            JsonObject payment = root.getAsJsonObject("response");

            // 필수 필드 존재 여부 검사
            if (!payment.has("status") || !payment.has("merchant_uid") || !payment.has("amount")) {
                System.err.println("❌ [결제 검증 오류] 필수 값 없음: " + payment);
                return false;
            }

            String statusStr = payment.get("status").getAsString();
            String serverMerchantUid = payment.get("merchant_uid").getAsString();
            int amount = payment.get("amount").getAsInt();

            System.out.println("📌 결제 상태 = " + statusStr);
            System.out.println("📌 서버 주문번호 = " + serverMerchantUid);
            System.out.println("📌 요청 주문번호 = " + merchantUid);
            System.out.println("📌 결제 금액 = " + amount);


            // 최종 검증 로직
            boolean valid = statusStr.equals("paid") &&
                    serverMerchantUid.equals(merchantUid);

            if (!valid) {
                System.err.println("❌ 결제 검증 실패: 상태/주문번호 불일치");
            }

            return valid;

        } catch (Exception e) {
            System.err.println("❌ [결제 검증 예외] " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
}
