#!/bin/bash

echo "지난 1개월 평일 데이터 추출 스크립트"
echo "=================================="

# 평일 날짜 배열 (8월 마지막주 + 9월 전체)
dates=(
  "20250826" "20250827" "20250828" "20250829" "20250830"
  "20250901" "20250902" "20250903" "20250904" "20250905"
  "20250908" "20250909" "20250910" "20250911" "20250912"
  "20250915" "20250916" "20250917" "20250918" "20250919"
  "20250922" "20250923" "20250924" "20250925" "20250926"
  "20250929"
)

success_count=0
total_count=${#dates[@]}

echo "총 $total_count개 평일 처리 시작..."
echo ""

for date_str in "${dates[@]}"; do
  echo "📅 처리 중: $date_str"
  
  # API 호출
  curl -s "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=cTcUsZGSUum0cSXCpxNdb3TouiJNxSLW&searchdate=$date_str&data=AP01" > temp_data.json
  
  # 데이터 개수 확인
  data_count=$(cat temp_data.json | jq 'length')
  
  if [ "$data_count" -gt 0 ]; then
    # 데이터 파일 저장
    cp temp_data.json "data/history/exchange-rates-$date_str.json"
    cp temp_data.json "data/daily/exchange-rates-$date_str.json"
    
    # USD 환율 추출
    usd_rate=$(cat temp_data.json | jq -r '.[] | select(.cur_unit == "USD") | .deal_bas_r')
    echo "  ✅ 저장 완료: USD $usd_rate원 ($data_count개 통화)"
    
    success_count=$((success_count + 1))
  else
    echo "  ❌ 데이터 없음"
  fi
  
  # API 호출 간격 조절
  sleep 0.5
done

# 임시 파일 정리
rm -f temp_data.json

echo ""
echo "📊 완료: $success_count/$total_count개 날짜 처리 완료"
echo "✅ 지난 1개월 평일 데이터 추출 완료"
