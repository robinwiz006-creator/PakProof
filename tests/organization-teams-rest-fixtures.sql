-- Disposable local identities only; never hosted.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) select ('a0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'team-rest-'||n||'@example.test',case when n=65 then null else now() end,jsonb_build_object('full_name','Team REST fixture '||n) from generate_series(60,65)n;
