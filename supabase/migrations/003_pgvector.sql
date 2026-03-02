-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Table to store user manifesto embeddings (1024 dimensions for mistral-embed)
create table if not exists public.manifesto_embeddings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  embedding vector(1024)
);

-- Table to store scraped articles and their summaries' embeddings
create table if not exists public.article_embeddings (
  url text primary key,
  title text not null,
  content text not null,
  source_interest text,
  embedding vector(1024),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an index to speed up vector similarity search
create index if not exists article_embeddings_embedding_idx on public.article_embeddings using hnsw (embedding vector_cosine_ops);

-- Function to match articles based on cosine similarity
create or replace function match_articles (
  query_embedding vector(1024),
  match_count int default 5
) returns table (
  url text,
  title text,
  content text,
  source_interest text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    article_embeddings.url,
    article_embeddings.title,
    article_embeddings.content,
    article_embeddings.source_interest,
    1 - (article_embeddings.embedding <=> query_embedding) as similarity
  from article_embeddings
  order by article_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- RLS Policies
alter table public.manifesto_embeddings enable row level security;
alter table public.article_embeddings enable row level security;

-- Only service role can manage embeddings for now to simplify
create policy "Service role can manage manifesto embeddings" on public.manifesto_embeddings for all using (auth.role() = 'service_role');
create policy "Service role can manage article embeddings" on public.article_embeddings for all using (auth.role() = 'service_role');

