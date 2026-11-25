# Build notes

This ZIP is the first runnable web implementation slice. It is intentionally labelled honestly: no external OCR, forecasting, push provider, offline queue, private upload pipeline, or full production auth enforcement is connected yet. The API is Node/Express and local data is stored in SQLite. The Supabase SQL file is a production migration foundation requiring review and integration tests.

Before public deployment, remove the no-token local preview mode in `backend/src/server.js`, enforce JWT for all routes, implement business membership authorization, and run the SQL migrations in a Supabase test project with RLS tests.
