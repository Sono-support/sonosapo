# プッシュ通知の設定（最初の1回だけ・約15分）

**プッシュ通知**とは：LINE のように、アプリを開いていなくてもスマホのロック画面に「あなたの質問に回答がつきました」と届く通知です。

しくみはこうです。

1. アプリの中で通知が作られる（回答がついた、など）
2. Supabase の「Database Webhook（データベースの変化を合図に、別のプログラムを呼ぶしかけ）」が動く
3. Supabase の「Edge Function（Supabase の上で動く小さなプログラム）」が、その人のスマホへ通知を送る

> 先に `supabase/05_update.sql` を実行し、GitHub に今回のファイルを上げておいてください。
> Supabase の画面の言葉は、ときどき変わります。見つからないときは、似た名前のボタンを探してください。

---

## 手順1　鍵を作る（アプリの管理画面）

1. 管理者でログイン → ホームの「**管理画面**」（管理者だけに表示されます）
2. 上のタブ「**プッシュ通知**」→「**鍵を作る**」
3. 3つの文字列が出ます。**このページは閉じずに**、次の手順へ進んでください
   - `VAPID_PUBLIC_KEY`（公開鍵）
   - `VAPID_PRIVATE_KEY`（秘密鍵）… **絶対に GitHub やチャットに貼らない**
   - `WEBHOOK_SECRET`（合言葉）

---

## 手順2　鍵を Supabase に登録する（Secrets）

**Secrets** とは：Edge Function だけが読める「秘密の設定」の置き場です。GitHub には載りません。

1. Supabase → 左メニュー **Edge Functions** → **Secrets**（または Project Settings → Edge Functions）
2. **Add new secret** で、次の3つを1つずつ登録（名前は大文字・そのまま）

| Name（名前） | Value（中身） |
|---|---|
| `VAPID_PUBLIC_KEY` | 手順1の公開鍵 |
| `VAPID_PRIVATE_KEY` | 手順1の秘密鍵 |
| `WEBHOOK_SECRET` | 手順1の合言葉 |

---

## 手順3　通知を送るプログラムを置く（Edge Function）

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**（画面上で書く）
2. 名前（Function name）を **`send-push`** にする
3. 中身を全部消して、このフォルダの `supabase/functions/send-push/index.ts` の中身を**全部**貼り付け
4. **Deploy function** を押す
5. できた `send-push` を開き、**Details**（または Settings）で **Enforce JWT verification（JWTの確認）** を**オフ**にして保存
   - 理由：このプログラムは「合言葉」で呼び出し元を確かめるので、もう一つの確認（JWT）は外します

---

## 手順4　合図のしかけを作る（Database Webhook）

1. Supabase → 左メニュー **Database** → **Webhooks**（初めてなら **Enable webhooks** を押す）
2. **Create a new hook**
3. 次のように入れる

| 項目 | 入れるもの |
|---|---|
| Name | `push` |
| Table | `notifications` |
| Events | **Insert** だけにチェック |
| Type of webhook | **Supabase Edge Functions**（なければ HTTP Request） |
| Edge Function | `send-push`（HTTP Request の場合は、send-push の URL） |
| Method | POST |
| HTTP Headers | **Add header** → Name：`x-webhook-secret`　Value：手順1の合言葉 |

4. **Create webhook** を押す

---

## 手順5　アプリに公開鍵を保存する

1. 手順1の管理画面に戻る
2. 「3つとも Supabase の Secrets に登録しました」にチェック
3. 「**公開鍵をアプリに保存して、通知を使えるようにする**」を押す

---

## 手順6　試す

1. スマホで、**ホーム画面に追加したソノサポ**を開く（iPhone は、こうしないと通知を設定できません）
2. 「アカウント」→「スマホに通知を受け取る」→「**通知を受け取る**」→ 許可する
3. 別の人（別のスマホ）に、自分のチャットの質問へ返信してもらう
4. ロック画面に通知が出れば完成です

### 届かないとき
- Supabase → Edge Functions → `send-push` → **Logs** に赤いエラーが出ていないか見る
  - `forbidden` … 合言葉（WEBHOOK_SECRET と Webhook のヘッダー）が一致していません
  - `VAPID` を含むエラー … 鍵の登録まちがい。手順1からやり直してください
- iPhone の「設定」→「通知」→「ソノサポ」で、通知が許可されているか見る

### 鍵を作り直したとき
全員がもう一度「通知を受け取る」を押す必要があります。古い登録先は、送れなかったときに自動で消えます。
