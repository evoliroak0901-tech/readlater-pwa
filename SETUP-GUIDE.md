# 🚀 ReadLater 完全セットアップガイド（最小手順）

**所要時間**: 約20分  
**難易度**: ★★☆☆☆（ほぼコピペ）

---

## ✅ Step 1: Supabaseプロジェクト作成（5分）

### 1-1. アカウント作成

1. https://supabase.com を開く
2. **「Start your project」** → **「Sign in with GitHub」**
3. GitHubでログイン（持っていなければGoogleでもOK）

### 1-2. プロジェクト作成

1. **「New Project」** をクリック
2. 入力：
   - **Organization**: 自動選択でOK
   - **Name**: `readlater`
   - **Database Password**: 自動生成されたものをコピー（メモ不要、後で確認可能）
   - **Region**: `Northeast Asia (Tokyo)`
   - **Pricing Plan**: **Free**（$0/month）を選択
3. **「Create new project」** をクリック
4. **2-3分待つ**（プロジェクトが作成されます）

### 1-3. API情報をコピー

プロジェクトが作成されたら：

1. 左サイドバー **「Settings」** → **「API」** をクリック
2. 以下をコピー：
   ```
   Project URL: https://xxxxx.supabase.co
   anon public key: eyJhbGc...（長い文字列）
   ```
3. メモ帳に貼り付けて保存

---

## ✅ Step 2: データベース作成（2分）

### 2-1. SQL実行

1. 左サイドバー **「SQL Editor」** をクリック
2. **「New query」** をクリック
3. 以下のSQLを**すべてコピペ**して **「Run」** をクリック

```sql
-- ユーザープロファイルテーブル
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 保存ページテーブル
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  url TEXT,
  title TEXT NOT NULL,
  favicon TEXT,
  domain TEXT,
  excerpt TEXT,
  tags TEXT[] DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX pages_user_id_idx ON pages(user_id);
CREATE INDEX pages_saved_at_idx ON pages(saved_at DESC);
CREATE INDEX pages_tags_idx ON pages USING GIN(tags);

-- Row Level Security (RLS) 有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- プロファイルポリシー
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ページポリシー
CREATE POLICY "Users can view own pages" ON pages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pages" ON pages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pages" ON pages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pages" ON pages FOR DELETE USING (auth.uid() = user_id);

-- 自動でprofileを作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

4. 成功したら **「Success. No rows returned」** と表示されます

---

## ✅ Step 3: Google認証設定（5分）

### 3-1. Supabaseで有効化

1. 左サイドバー **「Authentication」** → **「Providers」**
2. **「Google」** を探してクリック
3. **「Enable Sign in with Google」** をON
4. この画面は**開いたまま**にしておく

### 3-2. Google Cloud Console設定

1. 新しいタブで https://console.cloud.google.com を開く
2. **「プロジェクトを選択」** → **「新しいプロジェクト」**
3. プロジェクト名: `ReadLater` → **「作成」**
4. 左上のメニュー → **「APIとサービス」** → **「OAuth同意画面」**
5. **User Type: 外部** → **「作成」**
6. 入力：
   - **アプリ名**: `ReadLater`
   - **ユーザーサポートメール**: あなたのメール
   - **デベロッパーの連絡先**: あなたのメール
7. **「保存して次へ」** を3回クリック → **「ダッシュボードに戻る」**

### 3-3. OAuth認証情報作成

1. 左メニュー **「認証情報」** → **「認証情報を作成」** → **「OAuth クライアント ID」**
2. 選択：
   - **アプリケーションの種類**: ウェブアプリケーション
   - **名前**: `ReadLater Web`
3. **「承認済みのリダイレクト URI」** に追加：
   ```
   https://xxxxx.supabase.co/auth/v1/callback
   ```
   ⚠️ `xxxxx` を実際のSupabase URLに置き換え
4. **「作成」** をクリック
5. **クライアントID** と **クライアントシークレット** をコピー

### 3-4. SupabaseにGoogle情報を貼り付け

1. Supabaseの **「Google」** 設定画面に戻る
2. 貼り付け：
   - **Client ID (for OAuth)**: コピーしたクライアントID
   - **Client Secret (for OAuth)**: コピーしたクライアントシークレット
3. **「Save」** をクリック

---

## ✅ Step 4: コードにAPI情報を設定（1分）

### 4-1. supabase.jsを編集

1. エディタで開く:
   ```
   C:\Users\user\.gemini\antigravity\scratch\read-later-webapp\supabase.js
   ```

2. **2-3行目** を編集：
   ```javascript
   const SUPABASE_URL = 'https://xxxxx.supabase.co';  // 👈 Step 1-3でコピーしたURL
   const SUPABASE_ANON_KEY = 'eyJhbGc...';  // 👈 Step 1-3でコピーしたKey
   ```

3. **保存**

---

## ✅ Step 5: Vercelにデプロイ（3分）

### 5-1. GitHubにプッシュ

PowerShellで実行（コピペでOK）：

```powershell
cd C:\Users\user\.gemini\antigravity\scratch\read-later-webapp

# Git初期化
git init
git add .
git commit -m "Initial commit"

# GitHubにプッシュ（GitHub CLI使用）
gh repo create read-later-webapp --public --source=. --remote=origin --push
```

⚠️ GitHub CLIがない場合：
1. https://github.com/new でリポジトリ作成
2. 以下を実行：
   ```powershell
   git remote add origin https://github.com/[あなたのユーザー名]/read-later-webapp.git
   git branch -M main
   git push -u origin main
   ```

### 5-2. Vercelでデプロイ

1. https://vercel.com を開く
2. **「Sign Up」** → **「Continue with GitHub」**
3. **「New Project」** をクリック
4. **「Import」** で `read-later-webapp` を選択
5. **「Deploy」** をクリック（何も変更せずそのまま）
6. **2-3分待つ**
7. デプロイ完了！URLをコピー（例: `https://read-later-webapp.vercel.app`）

### 5-3. SupabaseにVercel URLを追加

1. Supabase → **「Authentication」** → **「URL Configuration」**
2. 追加：
   - **Site URL**: `https://read-later-webapp.vercel.app`
   - **Redirect URLs**: `https://read-later-webapp.vercel.app/**`
3. **「Save」** をクリック

---

## ✅ Step 6: Uptime Robot設定（1分）

### 6-1. モニター追加

1. Uptime Robotダッシュボード → **「Add New Monitor」**
2. 入力：
   ```
   Monitor Type: HTTP(s)
   Friendly Name: ReadLater - Supabase
   URL: https://xxxxx.supabase.co/rest/v1/
   Monitoring Interval: 5 minutes
   ```
3. **「Create Monitor」** をクリック

### 6-2. Vercelもモニター追加

1. **「Add New Monitor」**
2. 入力：
   ```
   Monitor Type: HTTP(s)
   Friendly Name: ReadLater - Vercel
   URL: https://read-later-webapp.vercel.app
   Monitoring Interval: 5 minutes
   ```
3. **「Create Monitor」** をクリック

---

## 🎉 完成！

おめでとうございます！すべて完了しました！

### ✅ 確認方法

1. **Vercel URL** にアクセス: `https://read-later-webapp.vercel.app`
2. **「Googleでログイン」** をクリック
3. ログイン成功！
4. **「新しく追加」** で記事を保存
5. **スマホ**からも同じURLにアクセス
6. **データが同期されている**ことを確認！🎊

### 🔧 Chrome拡張機能との同期

拡張機能からもSupabaseを使うには、`background.js`と`sidepanel.js`を修正する必要があります。

これも必要であれば対応します！

---

## 🆘 トラブルシューティング

### ログインできない
- Google OAuth設定を確認
- Redirect URLが正しいか確認

### データが同期されない
- supabase.jsのURLとKeyが正しいか確認
- ブラウザのコンソールでエラーを確認

### Uptime Robotがエラー
- URLが正しいか確認
- Supabaseプロジェクトが起動しているか確認

---

質問があればいつでも聞いてください！🚀
