# Supabase Connection Options

## Option 1: Direct Connection (Default)
Use the connection string from Settings → Database:
```
postgresql://postgres:password@db.project.supabase.co:5432/postgres
```

## Option 2: Connection Pooler (Recommended for Render)
If you get IPv6/connection errors, use the pooler:

1. Go to Supabase Dashboard → Settings → Database
2. Find "Connection Pooling" section
3. Enable "Connection pooling"
4. Use the "Connection string" from the pooler section:
```
postgresql://postgres:password@db.project.supabase.co:6543/postgres?pgbouncer=true
```

Note the different port (6543 instead of 5432) and the pgbouncer parameter.

## For Render Deployment

Add to environment variables:
```
DATABASE_URL=postgresql://postgres:YourPassword@db.snxcxrdhqojfnwtjqaiu.supabase.co:6543/postgres?pgbouncer=true
```

The pooler connection is more stable for serverless environments like Render.