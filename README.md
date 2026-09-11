# gift-shop

## overview

- we have admins and users
- for simplicity, all admins share a single admin account with a single admin password
- for simplicity, users no need to sign up for accounts, tho they are required to write their names at the end of their purchase
- admin fills in inventory (name, price, quantity, optional photo, optional notes)
- users browse thru catalogue in home page
    - showing the name, price, remaining quantity, photo
- catalogue will show "out of stock" if not enough quantity
- users can add to cart
- add to cart should follow some logic like checking if there really is that much quantity left
- after adding to cart, users can go to an order page
- users then submit their order
- admin can check the pending orders, and "fulfill" them once the goods and money is exchanged
- admin can also note down optional arbitrary notes on the orders
- once the order is fulfilled, inventory should update automatically
- order history should be preserved
- this assumes an in-real-life cash/coupon style shop, where this online catalogue is to help facilitate that experience

## target audience

- for use with kids, kids are the intended users, and admins are staff
- eg. use with accumulated coupons for kids to exchange for gifts

## rationale

- the purpose of fulfilling an order is to automate deducting inventory
- other than that, orders and inventory can be decoupled
- data needs to be as flexible as possible for any edge cases that arise (eg. price bargain)

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

# run all tests
bun test

# push schema to db.sqlite
bun run db:push
```

## tech stack

production

- [bun](https://bun.sh/)
- [elysia](https://elysiajs.com/)
- [drizzle with SQLite via Bun SQL](https://orm.drizzle.team/)
- [simplified handrolled version of lucia auth](https://lucia-auth.com/)
- [htmx 4](https://four.htmx.org/)
- [tailwindcss](https://tailwindcss.com/)

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

#### htmx

- downloaded file from https://cdn.jsdelivr.net/npm/htmx.org@4.0.0/dist/htmx.min.js
- served under /public via elysia's static file plugin

#### tailwind

- uses tailwind CLI to generate the css
- output served via /public/styles.css

### docs and notes

#### elysia

- Best Practices - MVC pattern: https://elysiajs.com/essential/best-practice.html
- HTML and JSX: https://elysiajs.com/plugins/html
- Static Files: https://elysiajs.com/plugins/static.html

#### drizzle

- SQLite Data Types: https://orm.drizzle.team/docs/sqlite/column-types
- SQLite Select: https://orm.drizzle.team/docs/sqlite/select
- SQLite Joins: https://orm.drizzle.team/docs/sqlite/joins

#### lucia auth

links

- https://lucia-auth.com/
- https://github.com/lucia-auth/lucia/blob/main/code/auth_session.ts

notes

- Lucia is deprecated, but is a one-file replacement
- at the same time, we dont have "users", just a single "admin"
- so we can reference the implementation and create a super simplified version of it

#### frontend javascript

- we bundle it using Bun (see `package.json` and `/src/pages/scripts/index.ts`)

#### htmx

- we are using HTMX 4 btw
    - changes from HTMX 2: https://four.htmx.org/docs#migrating-from-htmx-2x-to-4x
- Patterns: https://four.htmx.org/patterns
    - Lazy Load: https://four.htmx.org/patterns/lazy-load

## code conventions

### general

- user experience guides all decisions
- avoid over-engineering
- keep things minimal and simple
- use browser defaults and server rendering as much as possible, followed by htmx, followed by frontend js
    - tho user experience is king. eg. a UI loading state if needs frontend js, then let it be

### typescript

- function ordering, as pragmatic as possible, order from high level to low level functions, so it reads nicely

#### frontend scripts

- reference [rsjs - Reasonable System for JavaScript Structure](https://ricostacruz.com/rsjs/)
    - `data-js-scriptName` attribute on elements with `scriptName.ts` as the corresponding script for that attribute

### tailwind classes

- avoid margins as much as pragmatically possible

## troubleshooting

- beware of html/js/css caching, we use git SHA to invalidate cache, try commiting things arent working (especially frontend scripts)

## todos

- [x] startup test if schema is valid
- [x] admin login page
- [x] admin inventory page
- [x] shop catalogue page
- [x] setup htmx so forms can use resource-oriented HTTP verbs
- [x] setup tailwind
- [x] image uploading (JPEG, PNG, or WebP up to 5 MB)
- [x] admin inventory "edit mode" toggle, and then save
- [x] admin logout button
- [x] admin button in home page
- [x] admin inventory "hide item" control for catalogue
- [x] shop cart page
- [x] customer and admin orders pages
- [ ] major refactor - server side cart, server assigns a random id on load if browser local storage has no cart id. kind of like an "automatic login"
- [ ] bulletproof backend audit
- [ ] overengineering frontend audit
- [ ] proper loading states for any request that takes time (local image processing, server requests)
- [ ] ui polish
- [ ] colors
