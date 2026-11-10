-- LOCAL TEST/REHEARSAL ONLY. Never run bootstrap/default-grant fixtures hosted.
-- Reproduces the postgres-owned public defaults observed in the supplied catalog.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon,authenticated,service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon,authenticated,service_role;
