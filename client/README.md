# Client

The client is a React app that is built with [Vite](https://vite.dev).

## Scripts

- `pnpm start` runs the app in development mode on [http://localhost:3000](http://localhost:3000).
- `pnpm build` writes the production build to the `build` folder.
- `pnpm test` runs the unit tests with the Node test runner.

## Environment variables

Only the variables that start with `REACT_APP_` reach the bundle. Vite reads them from the
environment and from `client/.env`. `constants.js` also reads `PRIV_KEY` and
`BASE_SEPOLIA_HOST` for the Node scripts in `scripts`. These values must never be in the bundle,
so `vite.config.js` must not define `process.env` as a whole.

## Browser support

The build targets Chrome and Edge 111, Firefox 114, and Safari 16.4 (`build.target` in
`vite.config.js`).
