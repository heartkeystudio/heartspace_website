-- A RPC de salvamento cria hashes de revisão usando pgcrypto.digest().
-- Supabase mantém extensões no schema `extensions`, fora do search_path padrão
-- `public` usado pela função SECURITY DEFINER.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter function public.heartspace_save_doc_content(uuid, jsonb, timestamptz, text)
  set search_path = public, extensions;
