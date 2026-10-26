# MO-IT161 WebSys — Group 26

## 1. Application Development Workflow Worksheet
[Template – MO-IT161 – Application Development Workflow Worksheet – Group 26](https://docs.google.com/spreadsheets/d/1iUyWg36QpM2X0yW6WAh0VGKIu0lDrgFqWg09OUgTDbw/edit?usp=sharing)

## 2. AI Use Statement
[AI Use Statement – MO-IT161 WebSys – Group 26](https://docs.google.com/document/d/19dcvzPnw1qQBOc0uKe4zs28718Dlk8O6pGhdIxkrCzg/edit?usp=sharing)

Live static site: [GitHub Pages](https://tamayger.github.io/A3101Group-26_Real-Time-RC/The%20Data%20Entry.html)

## Run the application

Install the dependencies and start the Express server:

```sh
npm install
npm start
```

Open <http://localhost:3000> in a browser. The leaderboard, leaderboard search, results filters, podium, and entry forms are rendered or processed by the Node.js server. Lap-time separators are added in the browser as an input convenience.

## Server-rendered routes

- `/` renders the home page and its filtered leaderboard.
- `/leaderboard` renders the leaderboard and entry form.
- `/results` renders the podium, result table, and server-side filters.

## API endpoint

| Method | Route | Purpose | Response |
| --- | --- | --- | --- |
| `GET` | `/api/leaderboard` | Retrieves leaderboard records sorted by lap time. | JSON array |
| `POST` | `/api/leaderboard` | Adds a record for API clients. | JSON success response; `400` for invalid name or time |

## Form submission routes

These routes accept URL-encoded form data and redirect back to a rendered page; they do not return JSON.

| Method | Route | Form fields | Purpose |
| --- | --- | --- | --- |
| `POST` | `/times` | `name`, `time`, `eventName`, `date`, `returnTo` | Adds a lap-time record. |
| `POST` | `/results/delete` | `id`, `returnTo` | Removes a record. |

The server currently keeps submitted results in memory, so they reset when the server restarts.
