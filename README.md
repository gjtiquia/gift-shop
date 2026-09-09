# gift-shop

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
