# AGZ API

1. Copie `.env.example` para `.env` e defina segredos JWT e as credenciais `SEED_ADMIN_*`.
2. Execute `docker compose up -d`, `npm run prisma:deploy` e `npm run prisma:seed`.
3. Inicie com `npm run dev`. A API fica em `http://localhost:3000`, a documentação em `/docs` e o Mailpit em `http://localhost:8025`.

Executar `npm run prisma:seed` novamente sincroniza a conta administrativa com `SEED_ADMIN_*` e exige uma nova troca de senha no próximo login.

`UNAVAILABLE_WEEKDAYS` usa ISO-8601: `1` segunda-feira até `7` domingo. Exemplos: `2` bloqueia terça; `1,2` bloqueia segunda e terça.
