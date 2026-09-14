# Black Ball — versão local para testes

Esta versão inicia em modo local por padrão. Não exige cadastro, login,
Supabase, banco de dados ou chaves de API.

## Como iniciar

```bash
npm install
npm run dev
```

Depois abra:

- Aplicativo completo: `http://localhost:5173`
- Tela de partida: `http://localhost:5173/play`
- Jogo HTML5 direto: `http://localhost:5173/game/index.html`
- Loja e seleção de tacos: `http://localhost:5173/shop`

## Dados de teste

- Saldo inicial: R$ 1.000,00
- Os 6 tacos estão liberados
- Saldo, taco equipado, apostas e histórico usam somente `localStorage`
- O botão **Redefinir dados de teste** no perfil restaura o estado inicial
- O multiplayer fica desativado porque depende de banco e sincronização em tempo real

## Banco no futuro

O arquivo `.env` mantém `VITE_LOCAL_TEST_MODE=true`. Quando o backend estiver
pronto, altere para `false` e preencha as variáveis do Supabase indicadas em
`.env.example`.
