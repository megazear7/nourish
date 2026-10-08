# Nourish

A simple calorie tracker. Three quick-add buttons, saved meals, a daily goal, and a seven-day weighted color.

Today counts fully. Yesterday counts half. Each older day counts a little less, down to one seventh six days back. Eating under the goal pulls the color back toward green. 150 over the weighted window is yellow. 300 over is red.

## Offline

Nourish is an installable PWA. The first visit stores the app shell on the device. After that, today, history, meals, and the goal all open with no connection, including a refresh on `/history`, `/meals`, or `/goal`. Entries stay in localStorage on this device. Fonts and icons are part of the app, so nothing is loaded from another site.

## Stack

TypeScript, Zod, and Lit. No server. Data stays in localStorage. Ready for Netlify (`netlify.toml` publishes `dist/client`).

## Run

```
nvm use 22
npm install
npm start
```

Open http://localhost:3000
