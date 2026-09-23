/*
 * Configuração pública do portal da conta.
 *
 * A autenticação usa a instância oficial do HeartSpace. A chave publishable é própria para o
 * navegador; nunca coloque chaves de serviço ou segredos do Stripe aqui.
 * Configure o servidor de billing para devolver o checkout para
 * /account/?checkout=success ou /account/?checkout=cancelled.
 */
window.HEARTSPACE_ACCOUNT_CONFIG = {
    supabaseUrl: "https://yhjetfilhsjtjfvgqfod.supabase.co",
    supabaseAnonKey: "sb_publishable_sZOy3pHkcIbCQr2PwPSTog_Yw5BAxMR",
    studioFunctionUrl: "https://yhjetfilhsjtjfvgqfod.supabase.co/functions/v1/heartspace-studio",
    billingFunctionUrl: "",
    plans: {
        indie: "",
        studio: ""
    }
};
