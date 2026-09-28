# Operação do beta fechado

O beta não é controlado pelo navegador. A Edge Function `heartspace-studio` consulta a tabela `public.beta_access` antes de executar qualquer ação autenticada do site ou do Hub. A página de login apenas solicita um magic link para um e-mail previamente aprovado.

## Liberar uma pessoa

No Supabase, abra o **SQL Editor** e execute, trocando o e-mail pelo e-mail real e mantendo-o em minúsculas:

```sql
insert into public.beta_access (email, status, approved_at, notes)
values ('pessoa@exemplo.com', 'approved', timezone('utc', now()), 'Convite beta')
on conflict (email) do update
set status = 'approved',
    approved_at = timezone('utc', now()),
    notes = excluded.notes,
    updated_at = timezone('utc', now());
```

Depois, a pessoa acessa `https://www.heartspace.tools/login/`, informa esse mesmo e-mail e recebe o link de acesso. Uma conta Supabase é criada apenas nessa primeira entrada aprovada.

## Revogar o acesso

```sql
update public.beta_access
set status = 'revoked', updated_at = timezone('utc', now())
where email = 'pessoa@exemplo.com';
```

Na próxima ação autenticada, o site e o Hub recusam o acesso. Não apague o registro: manter o histórico evita liberar novamente por engano.

## Consultar a lista

```sql
select email, status, invited_at, approved_at, last_access_at, notes
from public.beta_access
order by invited_at desc;
```

## Ativação inicial

1. Aplique todas as migrations pendentes. A migration `20260927000200_closed_beta_access.sql` preserva automaticamente quem já pertencia a algum estúdio.
2. Faça deploy da Function `heartspace-studio`.
3. Libere manualmente qualquer pessoa de teste que ainda não pertencia a um estúdio.
4. Abra uma janela anônima e teste o login com um e-mail aprovado e outro não aprovado.

O beta é independente do billing. A futura integração com Paddle deve controlar planos e pagamentos, mas não deve substituir esta verificação de acesso até que o produto deixe de ser fechado.
