# Nordware Edu

Plataforma de treinamentos da Nordware no estilo Netflix, com checklist, documentos e comentários em cada aula.

- **Aluno:** assiste às aulas, marca o checklist, baixa documentos, comenta e acompanha o progresso.
- **Administrador:** cria treinamentos e aulas, envia capas, define a ordem, publica ou oculta conteúdo e gerencia permissões.
- **Vídeos:** YouTube (não listado), Vimeo (inclusive privado com código) ou envio do computador para o Supabase Storage.

Tecnologias: React 18, Vite, Supabase (Auth, Postgres com RLS, Storage e Realtime).

## 1. Configurar o Supabase

1. No painel do Supabase, abra **SQL Editor > New query**.
2. Cole e execute `supabase/migrations/0001_nordware_edu_schema.sql`.
3. Em seguida, execute `supabase/seed.sql` (cria os treinamentos Enviando, Roter e Bahn). Execute apenas uma vez.
4. Em **Authentication > Users**, crie o usuário do ADM master (samuel.bagolin@nordware.io) com **Auto Confirm User** marcado, caso ele ainda não exista. Esse e-mail recebe o papel de administrador automaticamente.
5. Em **Authentication > URL Configuration**, informe a URL do site publicado em **Site URL** e em **Redirect URLs** (necessário para a redefinição de senha).
6. Para vídeos grandes, ajuste **Storage > Settings > Upload file size limit** conforme o seu plano.

## 2. Rodar localmente

```bash
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

Use somente a chave pública (publishable/anon). Nunca coloque a chave `service_role` no frontend.

## 3. Publicar no GitHub Pages

1. No repositório, abra **Settings > Secrets and variables > Actions** e crie os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Em **Settings > Pages**, selecione **Source: GitHub Actions**.
3. Cada envio para a branch `main` publica o site em `https://samuelnordware.github.io/Nordware-Edu/`.

Opcional: crie a variável `VITE_ALLOW_SIGNUP` com valor `false` para esconder o cadastro aberto de alunos.

## Observações

- **YouTube:** vídeos marcados como Privado não podem ser incorporados. Use **Não listado**.
- **Vimeo privado:** libere o domínio do site em Privacidade > Onde o vídeo pode ser incorporado.
- **Fonte oficial:** coloque o arquivo em `public/fonts` e ajuste o `@font-face` no início de `src/styles.css`.
- **Capas:** ficam em `public/covers` no tamanho 1600 x 900. Novas capas podem ser enviadas pela área administrativa.

## Estrutura

```
supabase/          schema, RLS, buckets e dados iniciais
src/pages          Início, Treinamento, Aula, Login
src/pages/admin    Treinamentos, Editor de treinamento, Editor de aula, Usuários
src/components     Player, Checklist, Documentos, Comentários, Navegação
public/covers      Capas dos treinamentos
```

Dúvidas de segurança e compliance: security@nordware.io
