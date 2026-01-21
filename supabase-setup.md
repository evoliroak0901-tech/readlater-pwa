# 🗄️ Supabase セットアップガイド

## Step 1: Supabaseプロジェクト作成

1. **Supabaseにアクセス**
   - https://supabase.com
   - 「Start your project」をクリック
   - GitHubでサインイン

2. **新しいプロジェクトを作成**
   - 「New Project」をクリック
   - Project name: `readlater`
   - Database Password: 強力なパスワードを設定（メモしておく）
   - Region: `Northeast Asia (Tokyo)` を選択
   - 「Create new project」をクリック

3. **API設定を取得**
   - 左サイドバー「Project Settings」→「API」
   - 以下をコピー：
     - `Project URL` (例: https://xxxxx.supabase.co)
     - `anon public` key

## Step 2: データベーステーブル作成

1. **SQL Editorを開く**
   - 左サイドバー「SQL Editor」をクリック

2. **以下のSQLを実行**

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
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ページポリシー
CREATE POLICY "Users can view own pages" ON pages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pages" ON pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pages" ON pages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pages" ON pages
  FOR DELETE USING (auth.uid() = user_id);

-- 自動でprofileを作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

3. **「Run」をクリック**して実行

## Step 3: Google認証設定

1. **Google Cloud Consoleでプロジェクト作成**
   - https://console.cloud.google.com
   - 新しいプロジェクト作成: `ReadLater`

2. **OAuth同意画面の設定**
   - 「APIとサービス」→「OAuth同意画面」
   - User Type: 外部
   - アプリ名: `ReadLater`
   - サポートメール: あなたのメール
   - 保存

3. **認証情報の作成**
   - 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
   - アプリケーションの種類: ウェブアプリケーション
   - 名前: `ReadLater Web`
   - 承認済みのリダイレクト URI:
     ```
     https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
     ```
   - 「作成」をクリック
   - **クライアントIDとシークレット**をコピー

4. **SupabaseでGoogle認証を有効化**
   - Supabaseダッシュボード
   - 「Authentication」→「Providers」
   - 「Google」を有効化
   - Client IDとClient Secretを貼り付け
   - 保存

## Step 4: 環境変数設定

プロジェクトルートに `.env` ファイルを作成：

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## ✅ 完了！

これでSupabaseの準備が整いました。次はWebアプリとChrome拡張機能にSupabaseを統合します。
