import type { GitHubSyncInfo, UserBackupData } from '../types';

/**
 * GitHub API를 이용한 데이터 동기화 서비스
 */
export const githubSyncService = {
    /**
     * GitHub API 연결 상태를 테스트합니다. (토큰 필요 없음)
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch('https://api.github.com/zen');
            return response.ok;
        } catch (e) {
            return false;
        }
    },

    /**
     * GitHub에서 백업 데이터를 가져옵니다.
     */
    async fetchBackup(syncInfo: GitHubSyncInfo): Promise<{ data: UserBackupData; sha: string } | null> {
        const { pat, owner, repo, filePath } = syncInfo;
        const trimmedPat = pat.trim();
        // 경로의 각 부분을 안전하게 인코딩 (단, /는 유지)
        const encodedPath = filePath.split('/').map(part => encodeURIComponent(part)).join('/');
        const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': trimmedPat.startsWith('ghp_') ? `token ${trimmedPat}` : `Bearer ${trimmedPat}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 404) return null;
            if (!response.ok) {
                const err = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`GitHub API ${response.status}: ${err.message || response.statusText}`);
            }

            const json = await response.json();
            // Unicode 안전한 Base64 디코딩
            const decoded = decodeURIComponent(Array.prototype.map.call(atob(json.content.replace(/\s/g, '')), (c) => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return {
                data: JSON.parse(decoded),
                sha: json.sha
            };
        } catch (error: any) {
            console.error('Fetch Error Detail:', error);
            throw error;
        }
    },

    /**
     * GitHub에 백업 데이터를 저장합니다.
     */
    async pushBackup(syncInfo: GitHubSyncInfo, data: UserBackupData, sha?: string): Promise<string> {
        const { pat, owner, repo, filePath } = syncInfo;
        const trimmedPat = pat.trim();
        const encodedPath = filePath.split('/').map(part => encodeURIComponent(part)).join('/');
        const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;

        // Unicode 안전한 Base64 인코딩
        const jsonStr = JSON.stringify(data, null, 2);
        const content = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
        }));

        const body: any = {
            message: `data: User investment data backup - ${new Date().toLocaleString()}`,
            content: content,
            branch: 'main'
        };

        if (sha) body.sha = sha;

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': trimmedPat.startsWith('ghp_') ? `token ${trimmedPat}` : `Bearer ${trimmedPat}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorJson = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`GitHub API ${response.status}: ${errorJson.message || response.statusText}`);
            }

            const json = await response.json();
            return json.content.sha;
        } catch (error: any) {
            console.error('Push Error Detail:', error);
            throw error;
        }
    }
};
