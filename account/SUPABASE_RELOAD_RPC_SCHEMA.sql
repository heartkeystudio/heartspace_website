-- HeartSpace: recarrega o catálogo de funções RPC após criar/alterar funções SQL.
-- Seguro para executar mais de uma vez.
notify pgrst, 'reload schema';
