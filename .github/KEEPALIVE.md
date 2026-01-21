# 🤖 自動Keep-Alive BOT セットアップガイド

このBOTは週に1回、自動的にSupabaseにアクセスして非アクティブ状態を防ぎます。

## 🚀 セットアップ手順

### 1. GitHubリポジトリにプッシュ

```powershell
cd C:\Users\user\.gemini\antigravity\scratch\read-later-webapp

git add .github/
git commit -m "Add keep-alive bot"
git push
```

### 2. GitHub Secretsを設定

1. **GitHubリポジトリを開く**
   - https://github.com/[あなたのユーザー名]/read-later-webapp

2. **Settings → Secrets and variables → Actions**

3. **「New repository secret」をクリック**

4. **3つのSecretを追加**:

   **Secret 1:**
   - Name: `SUPABASE_URL`
   - Value: `https://xxxxx.supabase.co` （あなたのSupabase URL）

   **Secret 2:**
   - Name: `SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUz...` （あなたのSupabase Anon Key）

   **Secret 3 (オプション):**
   - Name: `VERCEL_URL`
   - Value: `your-app.vercel.app` （Vercelにデプロイ後のURL）

### 3. 動作確認

#### 手動実行で確認

1. GitHubリポジトリの **「Actions」タブ** を開く
2. 左側の「Keep Supabase Active」をクリック
3. 右側の **「Run workflow」** → 「Run workflow」をクリック
4. 数秒待つと実行結果が表示されます
5. ✅ グリーンになれば成功！

#### 自動実行スケジュール

- **毎週月曜日の午前9時（日本時間）**に自動実行
- 実行履歴は「Actions」タブで確認可能

## 📅 実行スケジュール

```
毎週月曜日 09:00 JST（日本時間）
```

変更したい場合は `.github/workflows/keep-alive.yml` の `cron` を編集：

```yaml
# 例: 毎日午前9時に実行
- cron: '0 0 * * *'

# 例: 3日に1回
- cron: '0 0 */3 * *'

# 例: 毎週水曜日と日曜日
- cron: '0 0 * * 0,3'
```

## 🔍 トラブルシューティング

### ❌ Actionが失敗する

**原因**: Secretsが正しく設定されていない

**解決方法**:
1. Settings → Secrets で値を確認
2. SUPABASE_URLとSUPABASE_ANON_KEYが正しいか確認

### ⚠️ Actionが実行されない

**原因**: リポジトリが非アクティブ

**解決方法**:
- GitHubの無料プランでは、60日間コミットがないと Actions が停止します
- 月に1回何かコミットすればOK

## 💡 メリット

✅ **完全無料** - GitHub Actionsは無料  
✅ **完全自動** - 何もしなくてOK  
✅ **確実** - GitHubのインフラで動作  
✅ **監視可能** - 実行履歴を確認できる  
✅ **手動実行も可能** - いつでもテスト実行できる

## 🎯 代替案

もしGitHub Actionsを使いたくない場合：

1. **Uptime Robot**（無料）
   - https://uptimerobot.com
   - URLを監視して定期的にアクセス
   - 設定が超簡単

2. **Better Uptime**（無料）
   - https://betteruptime.com
   - より高機能な監視サービス

3. **Cron-job.org**（無料）
   - https://cron-job.org
   - シンプルなcronジョブサービス

---

**推奨**: GitHub Actionsが最もシンプルで確実です！
