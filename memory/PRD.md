# LotePro - Product Requirements Document

## Overview
App mobile (Expo) de investimento em "lotes" com rendimento por hora. Usuários depositam via PIX, compram lotes (produtos de investimento) e recebem rendimento automaticamente durante um período (padrão 30 dias). Saques são solicitados pelo usuário e aprovados manualmente pelo admin.

## Stack
- **Frontend:** Expo Router (TypeScript), SafeAreaContext, Ionicons, expo-secure-store, react-native-qrcode-svg, expo-image-picker, expo-clipboard.
- **Backend:** FastAPI + Motor (MongoDB async) + PyJWT + bcrypt.
- **Idioma:** Português (Brasil).

## Features
- **Auth (email + senha JWT)**: cadastro, login, `GET /auth/me`, logout, tokens em SecureStore.
- **Admin oculto por role**: admin (role=admin) loga pela mesma tela; opção "Painel Administrativo" só aparece dentro da aba Perfil quando role=admin.
- **Loja de lotes**: admin cria, edita, desativa, exclui lotes com nome, descrição, preço, rendimento/hora, duração em dias e foto (base64 via image picker ou URL).
- **Compra de lote**: debita saldo e inicia cronômetro de rendimento.
- **Rendimento por hora**: calculado dinamicamente (`(segundos_ativos/3600) * hourly_yield`), atualizando em tempo real na UI com tick de 1s.
- **Carteira**: saldo disponível, lucros acumulados, botão coletar (`/me/collect`), histórico de transações.
- **Depósito PIX**: gera payload EMV (QR Code Copia e Cola) com chave PIX configurável, cria solicitação pendente para aprovação manual.
- **Saque**: reserva saldo no ato, informa chave PIX destino, admin aprova (mantém débito) ou rejeita (estorna).
- **Configurações PIX** (admin): chave, tipo, razão social, cidade.
- **Sobre/Licença**: página corporativa de confiança (CNPJ fictício, estatísticas, missão, termos).

## Credenciais admin
- Email: `ggc@gmail.com` | Senha: `@N1collas` (seed via `.env`, idempotente).
- Ver `/app/memory/test_credentials.md`.

## Modelos de dados (MongoDB)
- `users` { id, name, email, password_hash, role, balance, created_at }
- `lotes` { id, name, description, price, hourly_yield, duration_days, image_url, active, created_at }
- `purchases` { id, user_id, lote_id, price_paid, started_at, collected, created_at }
- `deposits` { id, user_id, amount, status, created_at, reviewed_at }
- `withdrawals` { id, user_id, amount, pix_key, pix_key_type, status, created_at, reviewed_at }
- `transactions` { id, user_id, type, amount, description, created_at }
- `settings` { id: "pix", pix_key, pix_key_type, company_name, beneficiary_city }

## Endpoints principais
Ver `/app/memory/test_credentials.md` para lista completa.

## Próximos passos possíveis
- Cartão de crédito via Stripe (o usuário pediu apenas PIX nesta iteração).
- Notificações push para status de depósito/saque.
- 2FA para admin.
- Referral/afiliados para crescer receita recorrente.
