# CCG Craft

Collectible Card Game Crafting Tool

## Prerequisites

- Git
- Node.js
- npm

## Get the source

```bash
git clone https://github.com/boltex/ccg-craft.git
cd ccg-craft
```

## Install dependencies

    npm install

## Start the development server

Runs the webpack dev server in development mode:

    npm run dev

The app is served at:

    http://localhost:8080

## Start the development server and open the browser

    npm start

## Build for production

Creates a production build in the dist folder:

    npm run build

## Type-check the project

Runs TypeScript without emitting build files:

    npm run type-check

## Project structure

- src: application source files
- public: static assets copied into the build output
- dist: generated production build output

## Notes

- The dev server uses hot reload.
- Static files from public are copied into the build output.
- Production output is written to dist.
