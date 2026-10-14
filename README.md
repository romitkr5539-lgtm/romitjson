# RomitJSON

Free browser-based JSON tools built with plain HTML, CSS and JavaScript.

## Tools
- Formatter, validator, viewer, editor, minifier and document comparison
- JSON to CSV, YAML, XML and TypeScript
- JSON Repair for conservative correction of common JSON-like syntax
- JSON Schema Validator for a documented subset of keywords
- JSON Size Analyzer for UTF-8 bytes, depth, field and value counts
- JSONPath Query for properties, brackets, array indices and wildcards

## Compatibility notes
JSON Repair does not infer missing values or braces. Schema validation is not a full implementation of all JSON Schema dialects and does not resolve references, composition keywords or the complete format vocabulary. JSONPath Query does not yet support recursive descent, filters, slices or functions.

## Privacy
The tools process input locally in the browser without a JSON-processing backend. Clipboard access depends on browser permissions. Large documents may use substantial device memory.

## Deployment
Serve as a static site. Keep robots.txt, sitemap.xml and favicon.svg at the domain root. When changing domains, update canonical URLs, structured data, the robots file and sitemap.
