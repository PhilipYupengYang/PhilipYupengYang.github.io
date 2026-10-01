# Philip Yang personal site

Static site, hosted free on GitHub Pages. All text lives in `content/*.json`, so you never have to touch the HTML.

## Edit the site (no code)

1. Go to https://app.pagescms.org and sign in with GitHub.
2. Pick this repository.
3. Choose a section in the sidebar (Profile, Projects, Leadership, Writing, Honors), click a field, type, and press **Save**.
4. The site updates by itself in about a minute.

You can upload images (headshot, project screenshots) and a new résumé PDF from the same screen.

## Files

- `index.html`: page structure
- `assets/style.css`: colors, fonts, layout (tokens at the top)
- `assets/app.js`: renders content and draws the hero graph
- `content/`: everything you edit
- `.pages.yml`: tells Pages CMS which fields to show

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
