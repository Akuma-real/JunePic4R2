'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface TokenInfo {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
  revoked: boolean;
}

export default function UploadTokenManager() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/upload-tokens');
      if (!res.ok) throw new Error('获取 token 失败');
      const data = await res.json() as { tokens: TokenInfo[] };
      setTokens(data.tokens);
    } catch (error) {
      console.error(error);
      toast.error('无法获取 token 列表');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/upload-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('创建失败');
      const data = await res.json() as { token: string };
      setNewTokenValue(data.token);
      setName('');
      toast.success('已生成新 Token');
      fetchTokens();
    } catch (error) {
      console.error(error);
      toast.error('创建 Token 失败');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const confirmed = confirm('确定要注销该 Token 吗？');
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/upload-tokens?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('注销失败');
      toast.success('Token 已注销');
      fetchTokens();
    } catch (error) {
      console.error(error);
      toast.error('注销 Token 失败');
    }
  };

  const formatTimestamp = (ts: number | null) => {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString();
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">上传 Token</h3>
        <p className="text-sm text-gray-500">
          生成 Token 后，可在 PicList / PicGo 等客户端中作为 Bearer Token 调用 /api/upload 接口。
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Token 名称</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="例如：PicList#1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="sm:flex-1"
          />
          <Button onClick={handleCreate} disabled={creating} className="sm:w-32">
            {creating ? '生成中…' : '生成 Token'}
          </Button>
        </div>
        {newTokenValue && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
            <p className="font-semibold mb-2">请立即复制保存，之后将无法再次查看完整 Token：</p>
            <Textarea readOnly value={newTokenValue} className="font-mono" rows={3} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">已生成的 Token</h4>
        {loading ? (
          <p className="text-sm text-gray-500">加载中…</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-gray-500">暂无可用 Token</p>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="border border-gray-200 dark:border-gray-700 rounded p-3 text-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{token.name}</p>
                    <p className="text-gray-500">
                      创建：{formatTimestamp(token.createdAt)}
                    </p>
                    <p className="text-gray-500">
                      最近使用：{formatTimestamp(token.lastUsedAt)}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevoke(token.id)}
                    className="sm:w-28"
                  >
                    注销
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">PicList 配置示例</h4>
        <Textarea
          readOnly
          className="font-mono text-xs"
          rows={8}
          value={`{
  "_configName": "JunePic4R2",
  "endpoint": "${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/upload/batch",
  "method": "POST",
  "formDataKey": "files",
  "headers": "{\"Authorization\": \"Bearer <你的Token>\"}",
  "body": "{}",
  "customPrefix": "",
  "resDataPath": "results.0.url"
}`}
        />
      </div>
    </Card>
  );
}
