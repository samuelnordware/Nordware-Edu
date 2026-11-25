# Nordware Edu

Plataforma de treinamentos da Nordware no estilo Netflix, com checklist, documentos e comentários em cada aula.

- **Aluno:** assiste às aulas, marca o checklist, baixa documentos, comenta e acompanha o progresso.
- **Professor:** tudo do aluno, mais criar e publicar os próprios treinamentos e moderar os comentários deles.
- **Gestor:** publica e edita qualquer treinamento, cria, exclui e altera o papel de usuários e redefine senhas.
- **Todos:** trocam a foto, o nome e a senha em Meu perfil.
- **Vídeos:** YouTube (não listado), Vimeo (inclusive privado com código) ou envio do computador para o Supabase Storage.

Tecnologias: React 18, Vite, Supabase (Auth, Postgres com RLS, Storage e Realtime).

## 1. Configurar o Supabase

1. No painel do Supabase, abra **SQL Editor > New query**.
2. Cole e execute `supabase/migrations/0001_nordware_edu_schema.sql`.
3. Em seguida, execute `supabase/seed.sql` (cria os treinamentos Enviando, Roter e Bahn). Execute apenas uma vez.
4. Execute `supabase/migrations/0002_papeis_e_fotos.sql` (papéis de aluno, professor e gestor, e fotos de perfil).
5. Publique a função de gestão de usuários: em **Edge Functions > Deploy a new function > Via Editor**, use o nome `admin-users`, cole o conteúdo de `supabase/functions/admin-users/index.ts` e clique em **Deploy function**. Mantenha a verificação de JWT ligada.
6. Em **Authentication > Users**, crie o usuário do ADM master (samuel.bagolin@nordware.io) com **Auto Confirm User** marcado, caso ele ainda não exista. Esse e-mail recebe o papel de administrador automaticamente.
7. Em **Authentication > URL Configuration**, informe a URL do site publicado em **Site URL** e em **Redirect URLs** (necessário para a redefinição de senha).
8. Para vídeos grandes, ajuste **Storage > Settings > Upload file size limit** conforme o seu plano.

## 2. Rodar localmente

```bash
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

Use somente a chave pública (publishable/anon). Nunca coloque a chave `service_role` no frontend.

## 3. Publicar na Vercel

1. Importe o repositório na Vercel com o preset **Vite**.
2. Em **Settings > Environment Variables**, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Cada envio para a branch `main` publica uma nova versão automaticamente.

Para que somente gestores criem contas: crie a variável `VITE_ALLOW_SIGNUP` com valor `false` na Vercel e desative **Allow new users to sign up** em **Authentication > Sign In / Providers** no Supabase.

## Observações

- **YouTube:** vídeos marcados como Privado não podem ser incorporados. Use **Não listado**.
- **Vimeo privado:** libere o domínio do site em Privacidade > Onde o vídeo pode ser incorporado.
- **Fonte oficial:** coloque o arquivo em `public/fonts` e ajuste o `@font-face` no início de `src/styles.css`.
- **Capas:** ficam em `public/covers` no tamanho 1600 x 900. Novas capas podem ser enviadas pela área administrativa.

## Estrutura

```
supabase/          schema, RLS, buckets, dados iniciais e função admin-users
src/pages          Início, Treinamento, Aula, Login, Meu perfil
src/pages/admin    Treinamentos, Editor de treinamento, Editor de aula, Usuários
src/components     Player, Checklist, Documentos, Comentários, Navegação
public/covers      Capas dos treinamentos
```

Dúvidas de segurança e compliance: security@nordware.io
