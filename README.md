# gift-shop

## setup

```bash
# install dependencies
bun install

# setup .env
cp .env.example .env

# setup db
bun run db:push

# start server at port 5000
PORT=5000 bun run start
```

## commands

```bash
# start server at port 3000
bun run start

# dev server at port 3000
bun run dev

# push schema to db.sqlite
bun run db:push
```

## tech stack

production
- [bun](https://bun.sh/)
- [elysia](https://elysiajs.com/)
- [drizzle with SQLite via Bun SQL](https://orm.drizzle.team/)

DX
- formatter: [prettier](https://prettier.io/)

### setup steps

#### elysia

```bash
bun create elysia .
```

#### drizzle

docs: https://orm.drizzle.team/docs/get-started/bun-sqlite-new

```bash
# install packages
bun add drizzle-orm@rc
bun add -D drizzle-kit@rc @types/bun

# setup .env and .env.example with DB_FILE_NAME=db.sqlite

# setup src/index.ts, src/db/schema.ts, and drizzle.config.ts

# apply changes to db
npx drizzle-kit push
```

#### prettier

```bash
bun i -D prettier

# create .prettierrc
```

### docs

#### elysia
- Best Practices - MVC pattern: https://elysiajs.com/essential/best-practice.html
- HTML and JSX: https://elysiajs.com/plugins/html

#### drizzle

- SQLite Data Types: https://orm.drizzle.team/docs/sqlite/column-types
- SQLite Select: https://orm.drizzle.team/docs/sqlite/select
- SQLite Joins: https://orm.drizzle.team/docs/sqlite/joins
