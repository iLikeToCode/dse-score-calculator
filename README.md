# DSE Score Calculator

Static checkbox scorecards for GitHub Pages.

Edit `data/scorecards.json`, then build:

```sh
npm run build
```

The build writes the deployable site to `dist/`.

## Data Shape

```json
{
  "scorecards": [
    {
      "year": "2026",
      "name": "Example Competition",
      "positive": [
        { "name": "Strong technical depth", "value": 5 }
      ],
      "negative": [
        { "name": "Late submission", "value": 3 }
      ]
    }
  ]
}
```

Items in `positive` render as `Achievements` and add their `value`. Negative items render under `Deductions` and subtract their `value`. The final score never goes below `0`.
