# 管理者のための運用メモ

決めたルール（SECURITY.md の A〜I）を続けるための、ときどきやることです。

---

## 1. 大事な3つのアカウントに2段階認証をつける（最初に1回・約20分）

**2段階認証**とは：パスワードに加えて、スマホのアプリに出る6桁の数字も入れないとログインできなくする設定です。パスワードが盗まれても、乗っ取られにくくなります。

まず、スマホに認証アプリ（**Google Authenticator** など、無料）を入れておきます。

| アカウント | 場所 | 手順 |
|---|---|---|
| Google | myaccount.google.com → **セキュリティ** → **2段階認証プロセス** | 「オンにする」→ 画面の案内どおり |
| GitHub | 右上のアイコン → **Settings** → **Password and authentication** → **Two-factor authentication** → **Enable** | 認証アプリでQRコードを読み取る → 6桁を入れる |
| Supabase | 左下のアイコン → **Account preferences**（または Account settings）→ **Security** / **Multi-factor authentication** → **Add new app** | 認証アプリでQRコードを読み取る → 6桁を入れる |

> **復旧コード（Recovery codes）**が表示されたら、必ず保存してください（紙に書いて保管、またはパスワード管理アプリ）。スマホをなくしたとき、これがないとログインできなくなります。

あわせて、アプリの管理者のパスワードは **16文字以上・他で使い回さない** ものにしてください。

---

## 2. 管理者が誰か確認する（数か月に1回）

Supabase → **SQL Editor** → New query に貼って **Run**。知らない人がいたら、すぐに相談してください。

```sql
select p.name, u.email, p.created_at
from public.profiles p join auth.users u on u.id = p.id
where p.role = 'admin';
```

---

## 3. 使われていない「名無しアカウント」を消す（数か月に1回）

招待コードを入れる前に作られ、そのまま使われなかったアカウントです（中身は何も見られないので、急がなくて大丈夫です）。

```sql
delete from auth.users u
where u.is_anonymous
  and not exists (select 1 from public.profiles p where p.id = u.id)
  and u.created_at < now() - interval '7 days';
```

---

## 4. 2年以上使われていないアカウントを確認する（年に1回）

まず一覧を見ます（消すのは、様子を見てから）。

```sql
select p.name, p.role, p.last_seen_at, p.created_at
from public.profiles p
where p.role <> 'admin'
  and coalesce(p.last_seen_at, p.created_at) < now() - interval '2 years'
order by p.last_seen_at nulls first;
```

消すときは、アプリの「退会」と同じく、投稿は「退会したメンバー」名義で残すのがルールです。やり方はそのとき相談してください。

---

## 5. 招待コードが漏れたとき

1. 管理画面 → 大学・コード → その大学の該当コードで「**作り直す**」
2. 確認者用コードが漏れた場合は、管理画面 → **確認者** で、知らない人を「**部員に戻す**」
3. 必要なら、その大学の代表者・指導医に新しいコードを渡す

---

## 6. 通報・連絡が届いたとき

ホームのベル（あなたへの通知）と、プッシュ通知に届きます。

- **通報**：管理画面 → 通報 → 内容を見て「投稿を削除」または「対応済みにする」
- **運営に連絡**：管理画面 → 連絡 → 返信を書いて「返信して対応済みにする」（送った人に通知が届きます）
- **安全上の問題**の連絡は赤いラベルで表示されます。最優先で確認してください

---

## 7. 規約・ポリシーを変えたとき

1. `legal.html` の文章を書き換える
2. `config.js` の `TERMS_VERSION` を新しい値にする（例：`'2027-04'`）→ 全員に、次に開いたとき同意の画面が出ます
3. `service-worker.js` の `VERSION` の数字を1つ上げる
4. お知らせで「規約を変えました」と伝える
