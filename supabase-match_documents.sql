create or replace function public.match_documents(
  query_embedding vector(1536),
  match_count int default 3
)
returns table (
  id bigint,
  title text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    d.id,
    d.title,
    d.content,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where d.embedding is not null
  order by d.embedding <=> query_embedding
  limit match_count;
$$;