# Nourish

A simple calorie tracker. Three quick-add buttons, saved meals, a daily goal, and a seven-day weighted color.

Today counts fully. Yesterday counts half. Each older day counts a little less, down to one seventh six days back. Eating under the goal pulls the color back toward green. 150 over the weighted window is yellow. 300 over is red.

## Stack

TypeScript, Zod, and Lit. No server. Data stays in localStorage. Ready for Netlify (`netlify.toml` publishes `dist/client`).

## Run

```
nvm use 22
npm install
npm start
```

Open http://localhost:3000
