# API: design and implementation plan

Status: **draft**. Not committed yet.

Based on `docs/v2/01-goal.md` (the API is the single entry point between front-end, Python calculations and Supabase), `docs/v2/02-calculations.md` (the `mortgage_calc` package the API imports) and `docs/v2/03-frontend.md` (the contract the front-end expects, section 6).

## 1. Decisions

| # | Decision |
|---|---|
| A1 | Framework: **FastAPI** (served by uvicorn). Typed, generates OpenAPI docs at `/docs`. |
| A2 | The API **imports `mortgage_calc` directly** (02-calculations Q1). No HTTP hop to a calculation service. |
| A3 | The API **does no math and no range validation**. It passes raw values to `mortgage_calc` and maps `ValidationError` to HTTP 422 (02-calculations Q5, Q6). |
| A4 | Scope: **calculator + saved calculations, anonymous** (no login). This extends 03-frontend F2 (see section 9). |
| A5 | Connection: **same origin only**. The API also serves the built front-end, so there is no CORS. In development the Vite dev server proxies `/api` to the API, so the browser still sees one origin. |
| A6 | Validation errors: **HTTP 422 with one error** `{field, code}`, exactly the `ApiError` type from 03-frontend. |
| A7 | Saved calculations store the **inputs only**. The result is recomputed on every read, so Python stays the only source of calculations and stored data can never go stale. |
| A8 | Supabase is accessed **only from the API**, with the service key. Row Level Security is on with no policies, so the public anon key cannot read or write the table. |

## 2. Responsibility

- Receive JSON from the front-end, hand the numbers to `mortgage_calc`, return the result.
- Store, load and delete saved calculations in Supabase.
- Map every failure to a stable `{field?, code}` body. No message text (02-calculations R3).
- Serve the built front-end files.
- It does **not** format numbers, does **not** know the bounds, and does **not** hold state between requests.

## 3. Endpoints

All paths are under `/api`. Bodies are JSON. Money is integer cents, rates are hundredths of a percent (same units as 02-calculations).

| Method | Path | Purpose | Success |
|---|---|---|---|
| POST | `/api/calculate` | Compute totals for four inputs, nothing stored | 200 `CalculateResponse` |
| POST | `/api/calculations` | Validate, store the inputs under a name | 201 `SavedCalculation` |
| GET | `/api/calculations/{id}` | Load one saved calculation, result recomputed | 200 `SavedCalculation` |
| DELETE | `/api/calculations/{id}` | Delete one saved calculation | 204 |
| GET | `/api/health` | Liveness check | 200 `{"status": "ok"}` |

`POST` is used for `/calculate` because it takes a body and has no side effect worth caching.

There is **no list endpoint** because there is no login and so no owner (see open question O1). The `id` is a random UUID; whoever knows it can read or delete that row.

### Types

```ts
// same as 03-frontend section 6
type CalculateRequest  = { price: number; down_h: number; rate_h: number; years: number };
type CalculateResponse = {
  loan: number; payment: number; last_payment: number;
  total_paid: number; total_interest: number; warnings: string[];
};

type SaveRequest = CalculateRequest & { name: string };   // name: 1-80 characters after trimming

type SavedCalculation = {
  id: string;                // uuid
  name: string;
  created_at: string;        // ISO 8601, UTC
  input: CalculateRequest;
  result: CalculateResponse; // recomputed on read
};
```

### Errors

| Situation | Status | Body |
|---|---|---|
| Input not an integer, missing, or `null` | 422 | `{"field": "price", "code": "not_integer"}` |
| Input out of range | 422 | `{"field": "years", "code": "out_of_range"}` |
| `name` empty or longer than 80 | 422 | `{"field": "name", "code": "invalid_name"}` |
| Body is not valid JSON or not an object | 400 | `{"code": "bad_request"}` |
| Saved calculation does not exist (or the id is not a UUID) | 404 | `{"code": "not_found"}` |
| Supabase unreachable or returned an error | 503 | `{"code": "storage_unavailable"}` |
| Any other exception (a bug) | 500 | `{"code": "internal_error"}` |

Rules:

- Missing field and `null` are treated as `not_integer`, so no new code is needed beyond 02-calculations.
- Extra unknown fields are ignored.
- Fields are checked in this order: `price`, `down_h`, `rate_h`, `years`, `name`. The first error is returned (one error per response, A6).
- FastAPI's default 422 format is replaced by exception handlers, so the response never has the default `detail` list.
- Request models do **not** use strict Pydantic ints. The raw JSON values go to `mortgage_calc`, which decides `not_integer` (including `bool`) and `out_of_range`. Otherwise the type check would exist in two places.
- 500 bodies never contain a traceback; the exception is logged.

## 4. Data flow

```
POST /api/calculate
  Front-end -> route -> MortgageInput(**body) -> mortgage_calc.calculate() -> CalculateResponse
                              ValidationError -> 422 {field, code}

POST /api/calculations
  Front-end -> route -> calculate() (validates, result discarded)
                     -> repository.add(name, input) -> Supabase insert
                     -> calculate() again for the response (or reuse the first result)
                     -> 201 SavedCalculation

GET /api/calculations/{id}
  Front-end -> route -> repository.get(id) -> Supabase select -> calculate(input) -> 200
                              no row -> 404
```

A stored row always passed validation when it was saved. If the bounds change in a later release and an old row becomes invalid, `GET` returns 422 with the field and code, which is the honest answer. (Not expected soon.)

## 5. Supabase

One table. Created by a SQL migration file in the repository, not by hand in the dashboard.

```sql
create table calculations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  price      integer not null,
  down_h     integer not null,
  rate_h     integer not null,
  years      integer not null,
  created_at timestamptz not null default now()
);

alter table calculations enable row level security;
-- no policies: only the service key (used by the API) can access the table
```

- No range checks on `price`, `down_h`, `rate_h`, `years` in SQL: `BOUNDS` live in Python only (one source of truth).
- Config comes from environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. The service key is never sent to the front-end and never committed. `.env.example` lists the names only.

### Storage abstraction

Routes talk to a small `Repository` interface, not to Supabase directly:

```python
class Repository(Protocol):
    def add(self, name: str, data: MortgageInput) -> StoredRow: ...
    def get(self, id: UUID) -> StoredRow | None: ...
    def delete(self, id: UUID) -> bool: ...   # False if nothing was deleted
```

Two implementations: `SupabaseRepository` (production) and `InMemoryRepository` (tests and local runs without Supabase). A Supabase failure is turned into one internal `StorageError`, which the handler maps to 503.

## 6. Folder structure

```
app-v2/
  calculations/              # exists (02)
  api/
    pyproject.toml           # depends on mortgage_calc (local path), fastapi, uvicorn, supabase
    .env.example
    src/
      mortgage_api/
        __init__.py
        main.py              # create_app(): routes, handlers, static mount
        config.py            # reads env vars (SUPABASE_*, STATIC_DIR)
        schemas.py           # response models (CalculateResponse, SavedCalculation)
        errors.py            # exception handlers -> {field?, code} bodies
        storage.py           # Repository, InMemoryRepository, SupabaseRepository, StorageError
        routes/
          calculate.py
          calculations.py
          health.py
    tests/
      test_calculate.py
      test_calculations.py
      test_errors.py
      test_storage_supabase.py   # skipped unless SUPABASE_* env vars are set
  supabase/
    migrations/
      0001_calculations.sql
  frontend/                  # planned (03)
```

`create_app(repository)` takes the repository as a parameter, so tests pass `InMemoryRepository` and need no network.

## 7. Testing

Tooling stays `pytest` (02-calculations Q7). FastAPI's `TestClient` needs `httpx`, which is the only extra dev dependency and is a test helper, not a linter or type checker.

- **`/calculate`**: one golden case from `golden.json` end to end (HTTP body in, same cents out); warning `low_down_payment` present at `down_h = 999` and absent at `1000`.
- **Errors**: each of `not_integer` (string, float, `null`, missing, `true`) and `out_of_range` returns 422 with the right `field` and `code`; field order is respected when two fields are wrong; malformed JSON gives 400; no response contains `detail`.
- **Saved calculations**: create, get (result equals `/calculate` for the same input), delete, get after delete gives 404, id that is not a UUID gives 404, invalid name gives 422 and nothing is stored, invalid inputs are not stored.
- **Storage failure**: a repository that raises `StorageError` gives 503 with `storage_unavailable`.
- **Supabase integration**: the same create/get/delete round trip against a real Supabase project, skipped when the env vars are missing, cleans up its row.
- **Contract check**: a test compares the keys and types of the `/calculate` response with the `CalculateResponse` type in `03-frontend.md` (kept as a small expected-keys constant).

## 8. Order of work

1. **Scaffold `app-v2/api`**: `pyproject.toml`, `create_app`, `/api/health`, test setup.
2. **`/api/calculate`** plus error handlers (`errors.py`) and their tests. After this step the front-end contract in 03-frontend is real and can be confirmed. The front-end can start here.
3. **Repository + saved calculations** with `InMemoryRepository`, the three `/api/calculations` routes and tests.
4. **Supabase**: create the project, write `0001_calculations.sql`, implement `SupabaseRepository`, add the opt-in integration test.
5. **Static serving**: mount the built front-end at `/`, with a fallback to `index.html`; document the run command.
6. **Docs**: update 03-frontend (section 9) and write a short run guide.

Steps 1 and 2 need only the calculations package. Steps 3 and 4 are independent of the front-end.

## 9. Changes needed in other documents

- **03-frontend.md**: F2 says "no saved calculations, no login". It must change to include saving and loading by id. Section 6 gains `SaveRequest`, `SavedCalculation` and the extra error codes `invalid_name`, `not_found`, `storage_unavailable`, `bad_request`, `internal_error`. The `ApiError` type must allow `field: "name"` and bodies without `field`. Since the API has no list endpoint, the front-end must remember saved ids itself (for example in `localStorage`) or show a link with the id.
- **02-calculations.md**: no change.

## 10. Open questions

| # | Question | Default if unanswered |
|---|---|---|
| O1 | How does a user get back to their saved calculations without login or a list endpoint? | Front-end keeps a list of ids in `localStorage`; each saved item is also a shareable link containing the id. |
| O2 | Is anyone able to delete a calculation if they know its id acceptable? | Yes for now, since saved data is only four numbers and a name. Revisit when login is added. |
| O3 | Rate limiting / abuse protection for the public `POST` endpoints? | None now. |
| O4 | Where will the API run (local only, or a hosting service)? | Local only; deployment is out of scope of this document. |
