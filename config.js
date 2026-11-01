// ================================================================
// ソノサポ 設定（Supabase の接続先）
// ================================================================
// ここに書くのは「公開しても大丈夫な鍵（anon key）」だけです。
// データは Supabase 側の鍵（RLS）で守っています。
//
// ⚠ service_role キー（秘密の鍵）は、絶対にここに書かないでください。
// ================================================================
window.SS_CONFIG = {
  SUPABASE_URL: 'https://gurbkfenumknfdnzxiuo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1cmJrZmVudW1rbmZkbnp4aXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNTA0ODMsImV4cCI6MjEwODkyNjQ4M30._brW-hLtw3bz9BB50Nh_sGVKgQCRRsc-AbwxO6AOYtM',
  APP_VERSION: '1.2.0'
};
