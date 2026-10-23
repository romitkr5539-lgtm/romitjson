# RomitJSON

RomitJSON is a set of free browser tools for common JSON tasks. Format, validate, inspect, edit, compare, and convert JSON without creating an account.

## Tools

- Format, pretty print, validate JSON syntax, repair common JSON-like syntax issues, generate JSON Schemas, and validate JSON against a schema
- Browse JSON in a searchable tree and find data with JSONPath
- Edit, copy, and download JSON
- Minify JSON
- Compare two JSON documents
- Convert JSON to CSV, Excel, SQL, YAML, or XML
- Generate TypeScript declarations, Java models, and Python TypedDict/dataclass models from JSON
- Browse 24 fictional JSON datasets with search, category filters, previews, copy/download, and direct links to JSON tools
- Read six practical JSON tutorials covering syntax, formatting, errors, schemas, APIs, and data conversions

## Run locally

The site is static and has no build step. Serve this folder with any local HTTP server, then open the local address in a browser. For example, Python includes a simple static server:

```sh
python -m http.server 8000
```

Open `http://localhost:8000` after starting the server. Serving over HTTP is useful for checking browser module loading in the YAML converter, JSON Schema Validator, and JSONPath Finder.

## Data handling

The tools process entered JSON in the browser. The YAML converter loads the `yaml` library from jsDelivr; the JSON input is not sent to that CDN by the converter. See [`privacy.html`](privacy.html) for the site's current data handling notes.

## Project files

- `index.html` — homepage and quick workspace
- `tools.html` — complete grid directory of JSON tools
- `datasets/` — searchable JSON dataset library and shared dataset detail page
- `learn/` — JSON tutorial library with six beginner-friendly articles
- `data/datasets/` — fictional JSON sample datasets used by the library
- `json-formatter/`, `json-pretty-printer/`, `json-validator/`, `json-repair/`, `json-schema-validator/`, `json-schema-generator/`, `json-viewer/`, `json-tree-viewer/`, `json-path-finder/`, `json-editor/` — JSON tools
- `json-compare/`, `json-minifier/` — comparison and minification tools
- `json-to-csv/`, `json-to-excel/`, `json-to-sql/`, `json-to-yaml/`, `json-to-xml/`, `json-to-typescript/`, `json-to-java/`, `json-to-python/` — converters and code generation
- `about.html`, `contact.html`, `faq.html`, `privacy.html` — project information and help
- `css/` — page styles
- `js/` — browser-side tool logic
- `js/dataset-catalog.js` — dataset categories and metadata
- `js/datasets.js`, `js/dataset-detail.js` — dataset search, filtering, preview, and page actions
- `robots.txt`, `sitemap.xml`, `404.html` — crawl and hosting support

## Before publishing

Deploy the contents of this folder at the root of `romitjson.com` so the canonical URLs and sitemap match. Configure the host to serve `404.html` for missing pages. The repository does not currently include a license; choose one before inviting code reuse or contributions.
