# BusinessOps AI — web SaaS starter

Responsive web adaptation of the supplied 27-page BusinessOps AI product specification. The current deliverable follows your later request for a **web app with a Node.js backend**. It uses a navy/sky-blue workspace palette and is designed to work on desktop and mobile browsers.

## Stack
- Frontend: React 18, Vite, Recharts, Lucide icons
- Backend: Node.js 20+ and Express
- Database: PostgreSQL (Neon) via `pg` connection pool (`database/neon-schema.sql`)
- Authentication foundation: bcrypt password hashing and JWT login/register endpoints

## Run on Windows
1. Install Node.js 20 LTS from https://nodejs.org/.
2. Extract the ZIP to a normal folder, for example `C:\Users\YourName\Projects\businessops-ai`.
3. Open that folder in VS Code.
4. Copy `.env.example` to `.env`.
5. Open a terminal in the project root and install each package set:

```powershell
npm install
npm --prefix backend install
npm --prefix frontend install
```

6. Start both servers:

```powershell
npm run dev
```

7. Open http://localhost:5173. API health check: http://localhost:4000/api/health.

The first run initializes the PostgreSQL schema (`database/neon-schema.sql`) and ensures the default workspace row (**My Business**) exists without overwriting existing data. Registration and login API endpoints are included.

## Build and production start
```powershell
npm run build
```
Then set `NODE_ENV=production` in `.env` and run:
```powershell
npm start
```
Express serves the built frontend from `frontend/dist`.

## Implemented workflows
- Business profile settings and currency selection.
- Product catalogue: add, list, archive; stock and minimum-stock tracking.
- Customer and supplier directories.
- Sales with a customer, product, quantity, price, partial payment and generated invoice number.
- Sales are committed in a database transaction: stock is checked, deducted and recorded in inventory movement history; insufficient stock is rejected.
- Purchase orders with supplier, product, ordered quantity and cost.
- Goods receiving endpoint supports partial deliveries and updates stock only by the verified received quantity.
- Payment and expense registers.
- Dashboard metrics, recent sales, low-stock alerts and sales chart derived from stored records.
- CSV exports for list views and print-to-PDF for the report summary.
- Notifications list and mark-as-read endpoint.
- Audit log records for core create operations.
- JWT registration/login endpoints with bcrypt password hashing.

## API endpoints
- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`
- `GET/POST/DELETE /api/products`, `PUT /api/products/:id`
- `GET/POST/DELETE /api/customers`
- `GET/POST/DELETE /api/suppliers`
- `GET/POST/DELETE /api/expenses`
- `GET/POST /api/sales`, `GET /api/sales/:id/items`
- `GET/POST /api/purchases`, `GET /api/purchases/:id/items`, `POST /api/purchases/:id/receive`
- `GET/POST /api/payments`
- `GET /api/dashboard`, `/api/reports`, `/api/notifications`, `/api/settings`
- `PUT /api/notifications/:id/read`, `PUT /api/settings`
- `POST /api/invoices/upload-record` (records an upload request only; not a file upload or OCR job)

## Important limitations — do not mistake these for completed features
This is a runnable first web implementation, not a production-certified accounting product. The original spec asks for OCR, private document storage, weighted-average inventory costing, full financial ledgers, demand forecasting, push notifications, offline sync, and complete role-based multi-business isolation. These are not all implemented yet.

- **OCR / invoice upload:** provider and secure storage are not configured. The current endpoint only records a pending-review metadata row; it does not accept file bytes or pretend to extract invoice fields. Add a private Supabase Storage bucket and a backend OCR provider before using this for invoices.
- **Forecasting:** not active. Dashboard low-stock signals are based on actual current stock; no prediction is presented as AI output.
- **Finance:** payments and expenses are stored; full accrual accounting, supplier payment reconciliation UI, weighted-average COGS, returns, tax and audit-grade P&L are not complete. The dashboard labels its profit estimate accordingly.
- **Authentication:** register/login endpoints exist, but the local preview bypasses authentication and defaults to business id 1. This is development-only. Disable the fallback and require verified JWT on every API route before deploying.
- **PostgreSQL:** the SQL file is a schema and RLS foundation, not a tested one-click Supabase migration. Review policies, add tests and configure Storage/Auth before production use.
- **Offline sync and push notifications:** not implemented; notification list scaffolding is present.

## Security before production
1. Set a long random `JWT_SECRET`; never use the development fallback.
2. Remove the no-token local demo fallback in `backend/src/server.js` and require JWT on all business routes.
3. Add role-based authorization checks for owner/manager/staff and test cross-business isolation.
4. Configure Supabase Auth/PostgreSQL/Storage and test every RLS policy with separate accounts.
5. Add secure multipart file upload, file type/size validation, private object storage and signed URLs.
6. Add idempotency keys for retried sale/purchase/payment requests and immutable financial reversal flows.
7. Add automated integration tests, backups, monitoring and deployment secrets.

## Main directories
```text
businessops-ai/
  frontend/                 React web application
    src/main.jsx            UI, navigation, forms and data views
    src/style.css           navy / sky-blue responsive theme
  backend/
    src/server.js           Express API and business workflows
    src/db.js               PostgreSQL (Neon) pool, transactions, and schema init
  database/
    neon-schema.sql         PostgreSQL / Neon schema and indexes
    migrate-sqlite-to-pg.mjs  One-time SQLite-to-PostgreSQL data migration script
  .env.example
```
