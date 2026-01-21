# 🚀 Supabase + Vercel デプロイガイド

## 📋 必要な手順

### 1. Supabaseプロジェクト作成 ⭐ **まずこれ！**

`supabase-setup.md` に沿って以下を実行：

1. https://supabase.com でプロジェクト作成
2. SQLを実行してデータベース作成
3. Google認証を設定
4. API keyをコピー

### 2. 環境変数の設定

`.env` ファイルを作成（`.env.example`をコピー）：

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**重要**: `supabase.js` の冒頭にある以下の値を置き換えてください：
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';      // 👈 ここ！
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';  // 👈 ここ！
```

### 3. GitHubにプッシュ

```powershell
cd C:\Users\user\.gemini\antigravity\scratch\read-later-webapp

# Gitリポジトリ初期化
git init
git add .
git commit -m "Initial commit with Supabase"

# GitHubにプッシュ（GitHub CLIを使用）
gh repo create read-later-webapp --public --source=. --remote=origin --push
```

または、GitHubウェブサイトでリポジトリを作成して：
```powershell
git remote add origin https://github.com/[あなたのユーザー名]/read-later-webapp.git
git branch -M main
git push -u origin main
```

### 4. Vercelにデプロイ

1. **Vercelにアクセス**
   - https://vercel.com
   - GitHubでログイン

2. **新しいプロジェクト作成**
   - 「New Project」をクリック
   - `read-later-webapp` リポジトリを選択

3. **環境変数を設定**
   - 「Environment Variables」セクション
   - 追加：
     ```
     VITE_SUPABASE_URL = https://xxxxx.supabase.co
     VITE_SUPABASE_ANON_KEY = eyJhbGc...
     ```

4. **デプロイ**
   - 「Deploy」をクリック
   - 数分で完了！

5. **完成！**
   - `https://あなたのアプリ.vercel.app` で公開されます
   - 世界中どこからでもアクセス可能！

### 5. Supabaseのリダイレクト設定

デプロイ後、VercelのURLがわかったら：

1. Supabaseダッシュボード
2. 「Authentication」→「URL Configuration」
3. 「Site URL」に追加：
   ```
   https://あなたのアプリ.vercel.app
   ```
4. 「Redirect URLs」に追加：
   ```
   https://あなたのアプリ.vercel.app
   ```

## 🎯 Chrome拡張機能との統合

拡張機能からもSupabaseを使うには、`background.js`と`sidepanel.js`を修正します。

詳細は作成済みの`supabase.js`を参考にしてください。

## ✅ 確認方法

1. デプロイされたURLにアクセス
2. 「Googleでログイン」をクリック
3. 認証後、ページを追加
4. スマホからも同じURLにアクセス
5.  **データが同期されている**ことを確認！🎉

---

**次のステップ**: Chrome拡張機能にもSupabaseを統合して、完全同期を実現！
