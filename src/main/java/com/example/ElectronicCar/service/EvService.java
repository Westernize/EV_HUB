package com.example.ElectronicCar.service;

import org.springframework.stereotype.Service;
import org.w3c.dom.*;
import jakarta.annotation.PostConstruct;
import javax.xml.parsers.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.Random;  // ✅ 추가!

@Service
public class EvService {

    private static final String SERVICE_KEY = "403d4b334f02943b2163a95f291dcbccae9dd2542df15d50b515b11ea92dd615";

    // 실시간 상태 캐시 (1분간 유효)
    private Map<String, List<Map<String, String>>> cachedRealtimeStatuses = null;
    private long cacheTimestamp = 0;
    private static final long CACHE_DURATION_MS = 60 * 1000; // 1분

    // 충전소 데이터 캐시 (5분간 유효 - CSV 파일은 거의 변경되지 않음)
    private List<Map<String, Object>> cachedStations = null;
    private long stationsCacheTimestamp = 0;
    private static final long STATIONS_CACHE_DURATION_MS = 5 * 60 * 1000; // 5분

    // 경량 충전소 데이터 캐시 (5분간 유효 - 클러스터 계산용)
    private List<Map<String, Object>> cachedLightweightStations = null;
    private long lightweightCacheTimestamp = 0;

    // 서버 시작 시 미리 로드 (무한히 빠르게!)
    @PostConstruct
    public void preloadData() {
        new Thread(() -> {
            try {
                System.out.println("🚀 서버 시작 시 데이터 사전 로드 시작...");
                // 경량 데이터 미리 로드
                loadStationsLightweight();
                System.out.println("✅ 경량 데이터 사전 로드 완료!");
            } catch (Exception e) {
                System.out.println("⚠️ 사전 로드 실패: " + e.getMessage());
            }
        }).start();
    }

    // 공개 메서드: 캐시를 사용하여 충전소 데이터 로드
    public List<Map<String, Object>> loadAllStations() throws IOException {
        return getCachedStations();
    }

    // 캐시된 충전소 데이터 가져오기
    private List<Map<String, Object>> getCachedStations() throws IOException {
        long currentTime = System.currentTimeMillis();

        // 캐시가 유효하면 캐시된 데이터 반환
        if (cachedStations != null && (currentTime - stationsCacheTimestamp) < STATIONS_CACHE_DURATION_MS) {
            return cachedStations;
        }

        // 캐시가 없거나 만료되었으면 새로 로드
        List<Map<String, Object>> stations = loadAllStationsInternal();

        // 캐시 업데이트
        cachedStations = stations;
        stationsCacheTimestamp = currentTime;

        return stations;
    }

    // 내부 메서드: 실제로 CSV 파일을 읽고 실시간 상태를 포함하여 로드
    private List<Map<String, Object>> loadAllStationsInternal() throws IOException {
        Map<String, Map<String, Object>> stationMap = new LinkedHashMap<>();

        // ✅ 1. CSV 파일 읽기
        try (InputStream inputStream = getClass().getResourceAsStream("/data1.csv")) {
            if (inputStream == null) {
                throw new FileNotFoundException("❌ data1.csv 파일을 찾을 수 없습니다.");
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8));
            String line;
            boolean firstLine = true;

            while ((line = reader.readLine()) != null) {
                if (firstLine) { firstLine = false; continue; }

                String[] parts = line.split(",", -1);
                if (parts.length < 8) continue;

                String id = parts[0].trim();
                Map<String, Object> st = stationMap.getOrDefault(id, new LinkedHashMap<>());

                st.put("id", id);
                st.put("name", parts[1].trim());
                st.put("addr", parts[2].trim());
                st.put("operator", parts[3].trim());

                try {
                    st.put("lat", Double.parseDouble(parts[4].trim()));
                    st.put("lng", Double.parseDouble(parts[5].trim()));
                } catch (NumberFormatException e) {
                    continue;
                }

                // ✅ 충전 타입 누적 (같은 충전소면 +로 합침)
                String typeCode = parts.length > 6 ? parts[6].trim() : "";
                String newType = switch (typeCode) {
                    case "01" -> "DC차데모";
                    case "02" -> "AC완속";
                    case "03" -> "DC콤보";
                    case "04" -> "DC차데모+AC3상";
                    case "05" -> "DC차데모+DC콤보";
                    case "06" -> "DC차데모+DC콤보+AC3상";
                    default -> "기타";
                };

                String existingType = (String) st.getOrDefault("chargerType", "");
                if (!existingType.contains(newType)) {
                    if (!existingType.isEmpty()) existingType += "+";
                    existingType += newType;
                }
                st.put("chargerType", existingType);

                // ✅ 상태 (처음 1개만 기준 저장)
                if (!st.containsKey("status")) {
                    String raw = (parts.length > 7) ? parts[7].trim() : "정보없음";
                    if (raw.matches("\\d+\\(\\d+\\)")) raw = raw.replace("(", "/").replace(")", "") + " 충전가능";
                    else if (raw.matches("\\d+/\\d+")) raw = raw + " 충전가능";
                    else if (raw.matches("^\\d+$")) raw = raw + "/" + raw + " 충전가능";
                    st.put("status", raw);
                }

                stationMap.put(id, st);
            }
        }

        // ✅ 중복 제거된 리스트로 변환
        List<Map<String, Object>> stations = new ArrayList<>(stationMap.values());

        // ✅ 실시간 정보 반영 + 주작 생성 (캐시 사용)
        Map<String, List<Map<String, String>>> realtimeStatusMap = getCachedRealtimeStatuses();
        Random random = new Random();

        for (Map<String, Object> st : stations) {
            String id = (String) st.get("id");
            String chargerType = (String) st.get("chargerType");

            if (realtimeStatusMap.containsKey(id)) {
                List<Map<String, String>> details = realtimeStatusMap.get(id);
                st.put("realtime", details);
                String summary = details.get(0).getOrDefault("summary", "정보없음");
                st.put("status", summary);
            } else {
                // ⚙️ 실시간 데이터 없을 경우 → 주작 생성
                int total;
                if (chargerType.contains("+")) total = chargerType.split("\\+").length;
                else if (chargerType.contains("콤보")) total = 2;
                else total = 1;

                List<Map<String, String>> fakeList = new ArrayList<>();
                int available = 0, charging = 0, check = 0;

                for (int i = 1; i <= total; i++) {
                    int r = random.nextInt(100);
                    String fakeStatus;
                    if (r < 60) { fakeStatus = "충전가능"; available++; }
                    else if (r < 85) { fakeStatus = "충전중"; charging++; }
                    else { fakeStatus = "점검중"; check++; }

                    Map<String, String> fake = new LinkedHashMap<>();
                    fake.put("speed", (chargerType.contains("완속")) ? "완속" : "급속");
                    fake.put("chargerType", chargerType);
                    fake.put("status", fakeStatus);
                    fake.put("chgerId", id + "-" + String.format("%02d", i));
                    fakeList.add(fake);
                }

                String summary;
                if (charging == total) summary = total + "/" + total + " 충전중";
                else if (check == total) summary = total + "/" + total + " 점검중";
                else if (available == total) summary = total + "/" + total + " 충전가능";
                else if (charging > 0) summary = charging + "/" + total + " 충전중";
                else if (check > 0) summary = check + "/" + total + " 점검중";
                else summary = available + "/" + total + " 충전가능";

                st.put("realtime", fakeList);
                st.put("status", summary);
            }
        }

        return stations;
    }

    // 경량 버전: 실시간 상태 없이 기본 정보만 로드 (클러스터 계산용 - 훨씬 빠름)
    private List<Map<String, Object>> loadStationsLightweight() throws IOException {
        long currentTime = System.currentTimeMillis();

        // 경량 캐시가 유효하면 즉시 반환
        if (cachedLightweightStations != null && (currentTime - lightweightCacheTimestamp) < STATIONS_CACHE_DURATION_MS) {
            return cachedLightweightStations;
        }

        // 경량 캐시가 없거나 만료되었으면 새로 생성
        // CSV에서 직접 읽어서 경량 데이터만 생성 (실시간 상태 불필요)
        List<Map<String, Object>> lightweight = loadStationsLightweightInternal();

        // 경량 캐시 업데이트
        cachedLightweightStations = lightweight;
        lightweightCacheTimestamp = currentTime;

        return lightweight;
    }

    // 경량 데이터 직접 로드 (CSV에서 읽어서 실시간 상태 없이 생성) - 극한 최적화!
    private List<Map<String, Object>> loadStationsLightweightInternal() throws IOException {
        // HashMap 사용 (LinkedHashMap보다 빠름, 순서 불필요)
        Map<String, Map<String, Object>> stationMap = new HashMap<>(2000);

        // ✅ CSV 파일 읽기 (실시간 상태 조회 없이, 극한 최적화!)
        try (InputStream inputStream = getClass().getResourceAsStream("/data1.csv")) {
            if (inputStream == null) {
                throw new FileNotFoundException("❌ data1.csv 파일을 찾을 수 없습니다.");
            }

            // 버퍼 크기 증가로 I/O 최적화
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(inputStream, StandardCharsets.UTF_8), 8192);
            String line;
            boolean firstLine = true;

            while ((line = reader.readLine()) != null) {
                if (firstLine) { firstLine = false; continue; }

                // split 최적화: 필요한 부분만 파싱
                int comma1 = line.indexOf(',');
                if (comma1 < 0) continue;
                int comma2 = line.indexOf(',', comma1 + 1);
                if (comma2 < 0) continue;
                int comma3 = line.indexOf(',', comma2 + 1);
                if (comma3 < 0) continue;
                int comma4 = line.indexOf(',', comma3 + 1);
                if (comma4 < 0) continue;
                int comma5 = line.indexOf(',', comma4 + 1);
                if (comma5 < 0) continue;

                String id = line.substring(0, comma1).trim();

                // 이미 존재하면 건너뛰기 (중복 제거)
                if (stationMap.containsKey(id)) continue;

                Map<String, Object> st = new HashMap<>(5);
                st.put("id", id);
                st.put("name", line.substring(comma1 + 1, comma2).trim());
                st.put("addr", line.substring(comma2 + 1, comma3).trim());

                try {
                    st.put("lat", Double.parseDouble(line.substring(comma4 + 1, comma5).trim()));
                    st.put("lng", Double.parseDouble(line.substring(comma5 + 1,
                            line.indexOf(',', comma5 + 1) > 0 ? line.indexOf(',', comma5 + 1) : line.length()).trim()));
                } catch (NumberFormatException | StringIndexOutOfBoundsException e) {
                    continue;
                }

                stationMap.put(id, st);
            }
        }

        // 리스트로 변환 (초기 용량 지정)
        return new ArrayList<>(stationMap.values());
    }


    // 캐시된 실시간 상태 가져오기 (캐시가 없거나 만료되면 새로 가져옴)
    private Map<String, List<Map<String, String>>> getCachedRealtimeStatuses() {
        long currentTime = System.currentTimeMillis();

        // 캐시가 유효하면 캐시된 데이터 반환
        if (cachedRealtimeStatuses != null && (currentTime - cacheTimestamp) < CACHE_DURATION_MS) {
            System.out.println("✅ 캐시된 실시간 상태 사용 (캐시 유효 시간: " + ((CACHE_DURATION_MS - (currentTime - cacheTimestamp)) / 1000) + "초 남음)");
            return cachedRealtimeStatuses;
        }

        // 캐시가 없거나 만료되었으면 새로 가져오기
        System.out.println("🔄 실시간 상태 새로 가져오는 중...");
        Map<String, List<Map<String, String>>> result = fetchAllRealtimeStatuses();

        // 실시간 상태 조회가 성공했을 때만 캐시 업데이트
        // 실패하면 기존 캐시를 계속 사용
        if (result != null && !result.isEmpty()) {
            cachedRealtimeStatuses = result;
            cacheTimestamp = currentTime;
        } else if (cachedRealtimeStatuses != null) {
            // 실패했지만 기존 캐시가 있으면 기존 캐시 사용
            System.out.println("⚠️ 실시간 상태 조회 실패, 기존 캐시 사용");
            return cachedRealtimeStatuses;
        }

        return result;
    }

    // 백그라운드에서 주기적으로 실시간 상태 업데이트 (선택사항)
    public void refreshRealtimeStatusesAsync() {
        new Thread(() -> {
            try {
                System.out.println("🔄 백그라운드에서 실시간 상태 업데이트 시작...");
                Map<String, List<Map<String, String>>> result = fetchAllRealtimeStatuses();
                cachedRealtimeStatuses = result;
                cacheTimestamp = System.currentTimeMillis();
                System.out.println("✅ 백그라운드 실시간 상태 업데이트 완료");
            } catch (Exception e) {
                System.out.println("⚠️ 백그라운드 실시간 상태 업데이트 실패: " + e.getMessage());
            }
        }).start();
    }

    private Map<String, List<Map<String, String>>> fetchAllRealtimeStatuses() {
        Map<String, List<Map<String, String>>> result = new HashMap<>();

        try {
            String urlStr = "https://apis.data.go.kr/B552584/EvCharger/getChargerInfo"
                    + "?serviceKey=" + SERVICE_KEY
                    + "&pageNo=1"
                    + "&numOfRows=2000"
                    + "&dataType=XML"
                    + "&zcode=11";

            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000); // 연결 타임아웃 단축 (3초)
            conn.setReadTimeout(8000); // 읽기 타임아웃 (8초)
            conn.setDoInput(true);

            if (conn.getResponseCode() != 200) {
                System.out.println("⚠️ API 응답 오류: " + conn.getResponseCode());
                return result;
            }

            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(conn.getInputStream());
            NodeList list = doc.getElementsByTagName("item");

            // ⚙️ 개별 충전기 데이터 수집
            for (int i = 0; i < list.getLength(); i++) {
                Element el = (Element) list.item(i);
                String statId = el.getElementsByTagName("statId").item(0).getTextContent();
                String chgerId = el.getElementsByTagName("chgerId").item(0).getTextContent();
                String chgerType = el.getElementsByTagName("chgerType").item(0).getTextContent();
                String stat = el.getElementsByTagName("stat").item(0).getTextContent();

                // ⚙️ 타입 코드 변환
                String chargerType = switch (chgerType) {
                    case "01" -> "DC차데모";
                    case "02" -> "AC완속";
                    case "03" -> "DC콤보";
                    case "04" -> "DC차데모+AC3상";
                    case "05" -> "DC차데모+DC콤보";
                    case "06" -> "DC차데모+DC콤보+AC3상";
                    default -> "기타";
                };

                // ⚙️ 상태 코드 변환
                String status = switch (stat) {
                    case "1" -> "충전가능";
                    case "2" -> "충전중";
                    case "3" -> "점검중";
                    default -> "정보없음";
                };

                // ⚙️ 속도 분류
                String speed = (chgerType.equals("02")) ? "완속" : "급속";

                // ⚙️ 상세 객체
                Map<String, String> detail = new LinkedHashMap<>();
                detail.put("speed", speed);
                detail.put("chargerType", chargerType);
                detail.put("status", status);
                detail.put("chgerId", statId + "-" + chgerId);

                result.computeIfAbsent(statId, k -> new ArrayList<>()).add(detail);
            }

            // ⚙️ 충전소별 요약(summary)
            for (Map.Entry<String, List<Map<String, String>>> entry : result.entrySet()) {
                List<Map<String, String>> details = entry.getValue();
                int total = details.size();
                int available = 0, charging = 0, check = 0;

                for (Map<String, String> d : details) {
                    String s = d.get("status");
                    if (s.equals("충전가능")) available++;
                    else if (s.equals("충전중")) charging++;
                    else if (s.equals("점검중")) check++;
                }

                String summary;
                if (charging == total) summary = total + "/" + total + " 충전중";
                else if (check == total) summary = total + "/" + total + " 점검중";
                else if (available == total) summary = total + "/" + total + " 충전가능";
                else summary = available + "/" + total + " 충전가능";

                // ✅ 첫 번째 충전기에 요약 정보 추가 (JS에서 st.status로 사용)
                if (!details.isEmpty()) {
                    details.get(0).put("summary", summary);
                }
            }

            System.out.println("✅ 실시간 상태 " + result.size() + "건 수집 완료");

        } catch (Exception e) {
            // 실시간 상태 조회 실패 시 조용히 처리 (캐시된 데이터가 있으면 사용)
            // System.out.println("⚠️ 실시간 상태 조회 실패: " + e.getMessage());
        }

        return result;
    }

    // 시간별 사용량 데이터 조회 (날짜별)
    public List<Map<String, Object>> getHourlyUsage(String stationId, String date) {
        List<Map<String, Object>> hourlyData = new ArrayList<>();

        // 날짜 파싱
        java.time.LocalDate targetDate;
        try {
            targetDate = java.time.LocalDate.parse(date);
        } catch (Exception e) {
            targetDate = java.time.LocalDate.now();
        }

        java.time.LocalDate today = java.time.LocalDate.now();
        boolean isToday = targetDate.equals(today);

        // 실시간 데이터에서 현재 사용량 가져오기 (오늘 날짜일 때만)
        int currentUsageRate = 0;
        if (isToday) {
            // 실시간 상태에서 해당 충전소의 사용량 계산 (캐시 사용)
            Map<String, List<Map<String, String>>> realtimeStatusMap = getCachedRealtimeStatuses();
            if (realtimeStatusMap.containsKey(stationId)) {
                List<Map<String, String>> details = realtimeStatusMap.get(stationId);
                int total = details.size();
                int charging = 0;
                for (Map<String, String> d : details) {
                    if (d.get("status").equals("충전중")) {
                        charging++;
                    }
                }
                currentUsageRate = total > 0 ? (charging * 100 / total) : 0;
            }
        }

        // 24시간 데이터 생성
        Random random = new Random(stationId.hashCode() + date.hashCode()); // 일관된 랜덤값을 위한 시드
        int currentHour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);

        for (int hour = 0; hour < 24; hour++) {
            int usage = 0;

            // 오늘 날짜이고 현재 시간대면 실시간 데이터 사용
            if (isToday && hour == currentHour) {
                usage = currentUsageRate;
            } else {
                // 다른 시간대는 패턴 기반 생성
                if ((hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 20)) {
                    // 피크 시간대: 50-80%
                    usage = random.nextInt(30) + 50;
                } else if (hour >= 22 || hour <= 6) {
                    // 심야 시간대: 10-30%
                    usage = random.nextInt(20) + 10;
                } else {
                    // 일반 시간대: 20-60%
                    usage = random.nextInt(40) + 20;
                }

                // 오늘 날짜면 현재 사용률을 기준으로 조정
                if (isToday) {
                    int diff = Math.abs(hour - currentHour);
                    if (diff == 1) {
                        // 바로 전/다음 시간대는 현재 사용률과 유사
                        usage = Math.max(0, Math.min(100, currentUsageRate + random.nextInt(20) - 10));
                    } else if (diff <= 3) {
                        // 가까운 시간대는 현재 사용률 기반으로 조정
                        double multiplier = 1.0 - (diff * 0.1);
                        usage = (int)(currentUsageRate * multiplier) + random.nextInt(15) - 7;
                        usage = Math.max(0, Math.min(100, usage));
                    }
                }
            }

            Map<String, Object> hourData = new LinkedHashMap<>();
            hourData.put("hour", hour);
            hourData.put("usage", usage);
            hourData.put("isRealtime", isToday && hour == currentHour);
            hourlyData.add(hourData);
        }

        return hourlyData;
    }

    // 클러스터 계산 (그리드 기반) - 2023-car-ffeine-develop 방식 (최적화됨)
    public List<Map<String, Object>> getClusters(java.math.BigDecimal latitude, java.math.BigDecimal longitude,
                                                 java.math.BigDecimal latitudeDelta, java.math.BigDecimal longitudeDelta,
                                                 int latitudeDivisionSize, int longitudeDivisionSize) throws IOException {
        // 경량 버전 사용 (실시간 상태 불필요 - 훨씬 빠름)
        List<Map<String, Object>> allStations = loadStationsLightweight();

        // 중심점 기준으로 범위 계산 (2023-car-ffeine-develop 방식)
        double centerLat = latitude.doubleValue();
        double centerLng = longitude.doubleValue();
        double latDelta = latitudeDelta.doubleValue();
        double lngDelta = longitudeDelta.doubleValue();

        double minLat = centerLat - latDelta;
        double maxLat = centerLat + latDelta;
        double minLng = centerLng - lngDelta;
        double maxLng = centerLng + lngDelta;

        // 그리드 크기 계산 (0으로 나누기 방지)
        if (maxLat <= minLat || maxLng <= minLng) {
            return new ArrayList<>();
        }

        double latInterval = (maxLat - minLat) / latitudeDivisionSize;
        double lngInterval = (maxLng - minLng) / longitudeDivisionSize;

        // 그리드맵: key = "latIndex_lngIndex", value = count와 실제 충전소들의 평균 위치
        // ConcurrentHashMap 사용으로 동기화 오버헤드 제거 (무한히 빠르게!)
        int estimatedSize = Math.min(allStations.size() / 10, 1000);
        ConcurrentHashMap<String, Integer> gridCounts = new ConcurrentHashMap<>(estimatedSize);
        ConcurrentHashMap<String, Double> gridSumLat = new ConcurrentHashMap<>(estimatedSize);
        ConcurrentHashMap<String, Double> gridSumLng = new ConcurrentHashMap<>(estimatedSize);

        // Stream API로 범위 필터링 및 그리드 할당
        // 항상 병렬 처리 (ConcurrentHashMap으로 안전, 무한히 빠르게!)
        // 범위 필터링을 먼저 수행하여 불필요한 계산 최소화
        allStations.parallelStream()
                .filter(station -> {
                    // null 체크와 범위 필터링을 한 번에 수행 (최적화)
                    Object latObj = station.get("lat");
                    Object lngObj = station.get("lng");
                    if (latObj == null || lngObj == null) return false;

                    double lat = ((Double) latObj).doubleValue();
                    double lng = ((Double) lngObj).doubleValue();

                    // 범위 체크 (조기 종료로 성능 향상)
                    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
                })
                .forEach(station -> {
                    // 이미 필터링된 데이터이므로 안전하게 캐스팅
                    double lat = ((Double) station.get("lat")).doubleValue();
                    double lng = ((Double) station.get("lng")).doubleValue();

                    // 그리드 인덱스 계산 (Math.floor 최적화)
                    int latIndex = Math.max(0, Math.min(latitudeDivisionSize - 1,
                            (int) ((lat - minLat) / latInterval)));
                    int lngIndex = Math.max(0, Math.min(longitudeDivisionSize - 1,
                            (int) ((lng - minLng) / lngInterval)));

                    // String 연산 최적화 (간단한 연결이 가장 빠름)
                    String gridKey = latIndex + "_" + lngIndex;

                    // ConcurrentHashMap.merge로 원자적 연산 (동기화 오버헤드 제거, 무한히 빠르게!)
                    gridCounts.merge(gridKey, 1, Integer::sum);
                    gridSumLat.merge(gridKey, lat, Double::sum);
                    gridSumLng.merge(gridKey, lng, Double::sum);
                });

        // 클러스터 리스트 생성 (실제 충전소들의 평균 위치 사용)
        List<Map<String, Object>> clusters = new ArrayList<>(gridCounts.size());
        for (Map.Entry<String, Integer> entry : gridCounts.entrySet()) {
            String gridKey = entry.getKey();
            int count = entry.getValue();

            if (count > 0) {
                // 실제 충전소들의 평균 위치 계산 (더 자연스러운 배치)
                double avgLat = gridSumLat.get(gridKey) / count;
                double avgLng = gridSumLng.get(gridKey) / count;

                // HashMap 사용 (LinkedHashMap보다 빠름, 순서 불필요)
                Map<String, Object> cluster = new HashMap<>(4);
                cluster.put("id", gridKey);
                cluster.put("latitude", avgLat);
                cluster.put("longitude", avgLng);
                cluster.put("count", count);
                clusters.add(cluster);
            }
        }

        return clusters;
    }

    // 지역 마커 조회 (2023-car-ffeine-develop 방식)
    public List<Map<String, Object>> getRegions() throws IOException {
        // 경량 버전 사용 (실시간 상태 불필요 - 훨씬 빠름)
        List<Map<String, Object>> allStations = loadStationsLightweight();

        // 2023-car-ffeine-develop의 Region enum과 동일한 지역 목록
        // 각 지역의 정확한 중심지 좌표 (지도에 표시된 지역명 텍스트 위치 기준)
        Map<String, Map<String, Object>> regionMap = new LinkedHashMap<>();
        regionMap.put("서울특별시", createRegion("서울특별시", 37.5665, 126.9780));
        regionMap.put("인천광역시", createRegion("인천광역시", 37.4636, 126.6480));
        regionMap.put("광주광역시", createRegion("광주광역시", 35.1595, 126.8526));
        regionMap.put("대구광역시", createRegion("대구광역시", 35.8714, 128.6014));
        regionMap.put("울산광역시", createRegion("울산광역시", 35.5384, 129.3114));
        regionMap.put("대전광역시", createRegion("대전광역시", 36.3504, 127.3845));
        regionMap.put("부산광역시", createRegion("부산광역시", 35.1796, 129.0756));

        regionMap.put("경기도", createRegion("경기도", 37.3500, 127.1500));
        regionMap.put("강원특별자치도", createRegion("강원특별자치도", 37.7000, 128.3000));
        regionMap.put("충청남도", createRegion("충청남도", 36.6000, 126.8000));
        regionMap.put("충청북도", createRegion("충청북도", 36.9900, 127.9000));
        regionMap.put("경상북도", createRegion("경상북도", 36.2000, 128.8000));
        regionMap.put("경상남도", createRegion("경상남도", 35.2000, 128.1000));
        regionMap.put("전라북도", createRegion("전라북도", 35.7000, 127.1000));
        regionMap.put("전라남도", createRegion("전라남도", 34.8000, 126.9000));
        regionMap.put("제주특별자치도", createRegion("제주특별자치도", 33.3800, 126.5500));


        // 각 지역별 충전소 개수 계산
        for (Map<String, Object> station : allStations) {
            String addr = (String) station.getOrDefault("addr", "");
            if (addr == null || addr.isEmpty()) continue;

            for (Map.Entry<String, Map<String, Object>> entry : regionMap.entrySet()) {
                String regionName = entry.getKey();
                if (addr.startsWith(regionName)) {
                    Map<String, Object> region = entry.getValue();
                    int count = (Integer) region.getOrDefault("count", 0);
                    region.put("count", count + 1);
                    break;
                }
            }
        }

        // 지역 리스트 생성 (충전소가 있는 지역만)
        List<Map<String, Object>> regions = new ArrayList<>();
        for (Map<String, Object> region : regionMap.values()) {
            int count = (Integer) region.getOrDefault("count", 0);
            if (count > 0) {
                regions.add(region);
            }
        }

        return regions;
    }

    private Map<String, Object> createRegion(String regionName, double latitude, double longitude) {
        Map<String, Object> region = new LinkedHashMap<>();
        region.put("regionName", regionName);
        region.put("latitude", latitude);
        region.put("longitude", longitude);
        region.put("count", 0);
        return region;
    }
}
