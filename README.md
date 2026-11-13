# LiveLap — Real-Time RC Results

MO-IT161 WebSys project by Group 26.

## Project documents

- [Application Development Workflow Worksheet](https://docs.google.com/spreadsheets/d/1iUyWg36QpM2X0yW6WAh0VGKIu0lDrgFqWg09OUgTDbw/edit?usp=sharing)
- [Functional Testing Workbook](https://docs.google.com/spreadsheets/d/15Z6NnbOzCtXBRyumJwtgNG7q1ab1pjIjEJ3qSDWx_Rk/edit?usp=sharing)
- [AI Use Statement](https://docs.google.com/document/d/19dcvzPnw1qQBOc0uKe4zs28718Dlk8O6pGhdIxkrCzg/edit?usp=sharing)
- [Static site demo](https://tamayger.github.io/A3101Group-26_Real-Time-RC/The%20Data%20Entry.html)

Event and run management requires the Express server; the static demo does not save data.

## Run locally

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Open <http://localhost:3000>. Use `npm start` to start the server without watch mode.

The repository includes `data/livelap.json` as a starter dataset. The server saves events, event-specific drivers and car assignments, and lap records in that file. To replace its contents with the sample dataset, run `npm run seed`; this overwrites the current local records.

The sample dataset includes multiple events on the same date, repeated driver names registered separately per event, assigned cars, three lap groups, and `N/A` lap times.

## Event and lap workflow

1. Go to **Manage Events** to create an event. Events on the same date remain separate. A new event becomes the active event automatically.
2. Select the active event from the navigation. The timing table, results, CSV export, and run entry all use that event. The choice is remembered in that browser.
3. On **Manage Events**, add drivers and assign each a car for the active event. Driver records are separate between events, even when names match. Removing a driver excludes them from future laps but keeps their results.
4. Open **Record lap times**. The form lists the event’s active drivers and their assigned cars. Choose a lap group and enter a time for each driver. Lap groups are numbered **Lap 1**, **Lap 2**, and so on; after submitting, the form advances to the next group. Selecting an existing group loads its times so they can be corrected.
5. Enter `N/A` when a driver has no time for that lap. It appears in results but is excluded from fastest-lap gaps and average calculations.
6. Removing an event asks for confirmation and deletes that event’s lap records and driver registrations.

## Pages

- `/` — live leaderboard for the active event, with driver search and lap-time entry.
- `/leaderboard` — alternate leaderboard page and lap-time entry.
- `/results` — lap results grouped by lap, filters, driver summary, and CSV export.
- `/events` — create and remove events; add, update, and remove drivers for the active event.

Leaderboard standings refresh every 15 seconds. Lap times can be entered as six digits in the browser; they are saved in `MM:SS.hh` format. `N/A` is also accepted.

## API

The API uses the active event selected by the browser cookie.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/leaderboard` | Returns lap records for the active event. Accepts optional `driver`, `vehicle`, and `date` filters. |
| `GET` | `/api/standings` | Returns driver standings for the active event. Accepts the same filters. |
| `POST` | `/api/leaderboard` | Adds or updates a driver’s lap record. Requires `name` and `time`; `lapGroup` is optional. The event supplies the date and registered driver supplies the car. `N/A` is accepted. |

## CSV export

`GET /results/export` downloads lap results for the active event, grouped by lap. It accepts the optional `driver`, `vehicle`, and `date` filters used on `/results`.

## Form routes

These routes accept URL-encoded form data and redirect to a rendered page.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/select-event` | Sets the active event in the current browser. |
| `POST` | `/events` | Creates an event from its name and date. |
| `POST` | `/events/remove` | Removes an event and its runs after confirmation. |
| `POST` | `/event-drivers` | Adds a driver and car to the active event, or updates that event’s car assignment. |
| `POST` | `/event-drivers/remove` | Removes a driver from the active roster after confirmation while keeping existing runs. |
| `POST` | `/times` | Uses `lapGroup` and one `lapTime_<driverId>` field per active driver to record or update a lap group. The event supplies the date and each driver’s assigned car. |
| `POST` | `/results/delete` | Removes a recorded lap. |
