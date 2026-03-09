import type { GitHubSyncInfo, UserBackupData } from '../types';

/**
 * GitHub API를 이용한 데이터 동기화 서비스
 */
export const githubSyncService = {
    /**
     * GitHub에서 백업 데이터를 가져옵니다.
     */
    async fetchBackup(syncInfo: GitHubSyncInfo): Promise<{ data: UserBackupData; sha: string } | null> {
        const { pat, owner, repo, filePath } = syncInfo;
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${pat}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.status === 404) return null;
            if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

            const json = await response.json();
            const content = atob(json.content);
            const decoded = decodeURIComponent(escape(content)); // UTF-8 대응

            return {
                data: JSON.parse(decoded),
                sha: json.sha
            };
        } catch (error) {
            console.error('Failed to fetch backup:', error);
            throw error;
        }
    },

    /**
     * GitHub에 백업 데이터를 저장합니다.
     */
    async pushBackup(syncInfo: GitHubSyncInfo, data: UserBackupData, sha?: string): Promise<string> {
        const { pat, owner, repo, filePath } = syncInfo;
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

        const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

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
                    'Authorization': `token ${pat}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorJson = await response.json();
                throw new Error(errorJson.message || `GitHub API error: ${response.statusText}`);
            }

            const json = await response.json();
            return json.content.sha;
        } catch (error) {
            console.error('Failed to push backup:', error);
            throw error;
        }
    }
};
