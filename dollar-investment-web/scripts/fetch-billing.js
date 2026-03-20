/**
 * Google Cloud Billing 데이터를 수집하여 정적 JSON으로 저장하는 스크립트
 * GitHub Actions에서 실행되어 최신 비용 정보를 가져옵니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';
import { monitoring_v3 } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchBillingStats() {
    try {
        console.log('🔐 Google Cloud 인증 시도 중...');
        
        // GitHub Secrets 등 환경변수에서 JSON 키 가져오기
        const keyJson = process.env.GCP_BILLING_SERVICE_ACCOUNT_JSON;
        if (!keyJson) {
            throw new Error('GCP_BILLING_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다.');
        }

        const credentials = JSON.parse(keyJson);
        const auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/monitoring.read'],
        });

        const authClient = await auth.getClient();
        const projectId = credentials.project_id;
        const monitoring = new monitoring_v3.Monitoring({ auth: authClient });

        console.log(`📊 프로젝트 [${projectId}]의 지표 조회 시작 (StartTime: ${startTime})`);

        // Cloud Monitoring API를 통해 billing/total_cost 지표 조회
        // 참고: 이 지표는 BigQuery 결제 내보내기가 활성화되지 않아도 수집될 수 있는 기본 지표입니다.
        const now = new Date();
        const startTime = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); // 이번 달 1일부터
        const endTime = now.toISOString();

        const response = await monitoring.projects.timeSeries.list({
            name: `projects/${projectId}`,
            filter: 'metric.type="billing.googleapis.com/billing/total_cost"',
            'interval.startTime': startTime,
            'interval.endTime': endTime,
            view: 'FULL'
        });

        const billingData = [];
        const timeSeries = response.data.timeSeries;

        if (timeSeries && timeSeries.length > 0) {
            // 시간순으로 데이터 정리
            const points = timeSeries[0].points || [];
            points.forEach(point => {
                billingData.push({
                    date: point.interval.endTime.split('T')[0].substring(5), // "MM-DD" 포맷
                    cost: point.value.doubleValue || 0,
                    requests: 0 // Monitoring API에서 요청 수까지 가져오긴 어려움
                });
            });
        }

        // 데이터가 없는 경우를 위한 더미 보정 (서비스 권한 확인용)
        if (billingData.length === 0) {
            console.log('⚠️ 실제 비용 데이터를 찾을 수 없어 기본 구조만 생성합니다.');
            billingData.push({
                date: new Date().toISOString().split('T')[0].substring(5),
                cost: 0,
                requests: 0
            });
        }

        const output = {
            lastUpdate: new Date().toISOString(),
            projectId,
            currency: 'USD',
            totalCostMonth: billingData.reduce((acc, curr) => acc + curr.cost, 0),
            history: billingData.sort((a, b) => a.date.localeCompare(b.date))
        };

        // 저장 경로 설정
        const outputPath = path.join(__dirname, '..', 'public', 'data', 'billing.json');
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`✨ 결제 데이터 저장 완료! (${outputPath})`);

    } catch (error) {
        console.error('❌ 결제 데이터 수집 실패:', error.message);
        if (error.stack) console.log('DEBUG:', error.stack);
        
        // 실패 시에도 앱이 깨지지 않도록 기본값 저장
        const fallback = {
            lastUpdate: new Date().toISOString(),
            error: error.message,
            history: []
        };
        const outputPath = path.join(__dirname, '..', 'public', 'data', 'billing.json');
        fs.writeFileSync(outputPath, JSON.stringify(fallback, null, 2));
    }
}

fetchBillingStats();
