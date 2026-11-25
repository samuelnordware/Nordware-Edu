-- =====================================================================
-- Nordware Edu - treinamentos iniciais (Enviando, Roter, Bahn)
-- Execute depois da migracao 0001. Pode ser executado apenas uma vez.
-- As capas ficam em /public/covers no proprio site.
-- =====================================================================

with c as (
  insert into public.courses (title, subtitle, description, category, cover_url, accent_color, is_featured, is_published, sort_order)
  values
    ('Enviando', 'Treinamento oficial da plataforma Enviando',
     'Conheça a plataforma Enviando: a visão geral do produto, os primeiros passos e as rotinas do dia a dia.',
     'Produtos Nordware', 'covers/enviando.jpg', '#5AAF5C', true, true, 1),
    ('Roter', 'Treinamento oficial da plataforma Roter',
     'Aprenda a usar o Roter do início ao fim, com demonstrações práticas de cada etapa.',
     'Produtos Nordware', 'covers/roter.jpg', '#EE2F5A', false, true, 2),
    ('Bahn', 'Treinamento oficial da plataforma Bahn',
     'Entenda como o Bahn funciona e como aplicá-lo na sua operação.',
     'Produtos Nordware', 'covers/bahn.jpg', '#00C1B4', false, true, 3)
  returning id, title
),
l as (
  insert into public.lessons (course_id, title, description, video_provider, video_ref, sort_order)
  select c.id, v.title, v.description, 'youtube', v.video, 1
  from c
  join (values
    ('Enviando', 'Apresentação do Enviando', 'Visão geral da plataforma e principais recursos.', 'https://www.youtube.com/watch?v=r3-DRGerbs8'),
    ('Roter',    'Apresentação do Roter',    'Visão geral da plataforma e principais recursos.', 'https://www.youtube.com/watch?v=ZQ77fvZASpk'),
    ('Bahn',     'Apresentação do Bahn',     'Visão geral da plataforma e principais recursos.', 'https://www.youtube.com/watch?v=ZzNxun-bMLw')
  ) as v(course, title, description, video) on v.course = c.title
  returning id
)
insert into public.checklist_items (lesson_id, label, sort_order)
select l.id, x.label, x.ord
from l
cross join (values
  ('Assistir ao video completo', 1),
  ('Acessar a plataforma com o seu usuario', 2),
  ('Ler o material de apoio da aula', 3),
  ('Registrar suas dúvidas nos comentários', 4)
) as x(label, ord);
