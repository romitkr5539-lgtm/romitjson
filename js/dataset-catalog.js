window.romitJsonDatasets = {
  categories: [
    'Users and Profiles',
    'Employees and Companies',
    'Products and Categories',
    'Orders and Transactions',
    'Blog Posts and Comments',
    'Social Media Data',
    'Countries, States, and Cities',
    'Books and Authors',
    'Movies and Entertainment',
    'Recipes and Food',
    'Education and Students',
    'Jobs and Applications',
    'Travel and Hotels',
    'Weather Examples',
    'API Success Responses',
    'API Error Responses',
    'Pagination Examples',
    'Nested JSON Examples',
    'JSON Schema Examples',
    'Testing and Edge Cases',
  ],
  datasets: [
    { slug: 'users', name: 'Users and Profiles', file: 'users.json', category: 'Users and Profiles', records: 3, description: 'Three fictional user profiles include IDs, names, example.com emails, activity flags, join dates, nested profile details, role arrays, preferences, and both null and filled bios. Use this data to test profile screens, nested object rendering, nullable fields, and user-list API responses.', related: ['employees', 'students'], tool: 'json-viewer' },
    { slug: 'employees', name: 'Employees and Companies', file: 'employees.json', category: 'Employees and Companies', records: 2, description: 'Two fictional employee records show job titles, company and department details, office locations, manager information, and skill lists. Use them to explore nested workplace data or test employee directories and JSON-to-table conversion.', related: ['users', 'jobs'], tool: 'json-to-csv' },
    { slug: 'products', name: 'Products and Categories', file: 'products.json', category: 'Products and Categories', records: 3, description: 'Three catalog items combine product names and IDs with nested categories, prices, stock counts, tags, and variant arrays. Use this sample to test product listings, inventory displays, and conversion of nested commerce data.', related: ['orders', 'recipes'], tool: 'json-to-csv' },
    { slug: 'orders', name: 'Orders and Transactions', file: 'orders.json', category: 'Orders and Transactions', records: 2, description: 'Two fictional orders include customer references, line-item arrays, shipping details, totals, dates, and different order statuses. Use them to inspect transaction structures or test order summaries, data tables, and JSON-to-SQL workflows.', related: ['products', 'api-success'], tool: 'json-to-sql' },
    { slug: 'posts', name: 'Blog Posts', file: 'posts.json', category: 'Blog Posts and Comments', records: 2, description: 'Two blog post objects demonstrate titles, body text, author details, tags, publication state, dates, and comment counts. Use this sample to prototype a content feed or test nested author data and post-list rendering.', related: ['comments', 'social-media'], tool: 'json-viewer' },
    { slug: 'comments', name: 'Blog Comments', file: 'comments.json', category: 'Blog Posts and Comments', records: 3, description: 'Three comment records include post references, comment text, nested author information, timestamps, moderation flags, and reply references. Use them to test comment threads, moderation views, and relationships between related JSON records.', related: ['posts', 'users'], tool: 'json-to-sql' },
    { slug: 'social-media', name: 'Social Media Posts', file: 'social-media.json', category: 'Social Media Data', records: 2, description: 'Two fictional social posts pair author profiles with post text, timestamps, hashtags, engagement counts, and optional media details. Use this data to test feed cards, mixed optional fields, and nested social activity.', related: ['posts', 'comments'], tool: 'json-viewer' },
    { slug: 'countries', name: 'Countries, States, and Cities', file: 'countries.json', category: 'Countries, States, and Cities', records: 2, description: 'Two country examples organize capitals, regions, currencies, languages, states, and city lists into nested structures. Use them to test location pickers, hierarchical menus, or rendering of geographic data at multiple levels.', related: ['travel', 'weather'], tool: 'json-to-csv' },
    { slug: 'books', name: 'Books and Authors', file: 'books.json', category: 'Books and Authors', records: 2, description: 'Two fictional book entries include titles, author references, publication details, format lists, and nullable identifiers. Use this sample to build a book catalog or test optional values and arrays in library data.', related: ['movies', 'products'], tool: 'json-to-csv' },
    { slug: 'movies', name: 'Movies and Entertainment', file: 'movies.json', category: 'Movies and Entertainment', records: 2, description: 'Two fictional film records combine titles with genres, cast arrays, ratings, runtimes, release details, and production information. Use them to test entertainment catalogs, filterable lists, and display of numeric ratings.', related: ['books', 'posts'], tool: 'json-to-csv' },
    { slug: 'recipes', name: 'Recipes and Food', file: 'recipes.json', category: 'Recipes and Food', records: 2, description: 'Two recipes include ingredient objects and quantities, preparation times, serving counts, ordered cooking steps, and allergen examples. Use them to test nested lists, recipe cards, and data structures with repeated ingredient records.', related: ['products', 'students'], tool: 'json-viewer' },
    { slug: 'students', name: 'Education and Students', file: 'students.json', category: 'Education and Students', records: 2, description: 'Two fictional student records show enrollment status, course and grade details, advisor information, and nullable fields. Use this sample to prototype student dashboards or test arrays of courses and mixed data types.', related: ['users', 'employees'], tool: 'json-to-csv' },
    { slug: 'jobs', name: 'Jobs and Applications', file: 'jobs.json', category: 'Jobs and Applications', records: 2, description: 'Two sample job listings include role descriptions, locations, employment types, salary ranges, required skills, and application deadlines. Use them to test job-board cards, salary filters, and structured listing data.', related: ['employees', 'users'], tool: 'json-to-csv' },
    { slug: 'travel', name: 'Travel and Hotels', file: 'travel.json', category: 'Travel and Hotels', records: 2, description: 'Two fictional travel bookings include destinations, hotel details and amenities, stay dates, guest counts, and payment totals. Use this sample to explore nested booking data or test itinerary and reservation interfaces.', related: ['countries', 'products'], tool: 'json-viewer' },
    { slug: 'weather', name: 'Weather Examples', file: 'weather.json', category: 'Weather Examples', records: 2, description: 'Two weather observations organize location details alongside temperatures, wind, humidity, and precipitation measurements. Use them to test weather cards, numeric units, and nested location-plus-conditions responses.', related: ['countries', 'api-success'], tool: 'json-to-csv' },
    { slug: 'api-success', name: 'API Success Responses', file: 'api-success.json', category: 'API Success Responses', records: 1, description: 'One example of a successful API response wraps returned data with status and request metadata. Use it to understand a common response envelope or test how an application reads payloads from a success response.', related: ['api-error', 'pagination'], tool: 'json-validator' },
    { slug: 'api-error', name: 'API Error Responses', file: 'api-error.json', category: 'API Error Responses', records: 1, description: 'One structured error response demonstrates an error code and message, field-level validation issues, and retry-related metadata. Use it to test error displays, validation feedback, and client handling of unsuccessful responses.', related: ['api-success', 'pagination'], tool: 'json-validator' },
    { slug: 'pagination', name: 'Pagination Examples', file: 'pagination.json', category: 'Pagination Examples', records: 1, description: 'One paginated API response contains a page of result records plus page size, current and total counts, and navigation flags. Use it to test pagers, next/previous controls, and client logic for reading paginated results.', related: ['api-success', 'large-array'], tool: 'json-viewer' },
    { slug: 'nested', name: 'Nested JSON Examples', file: 'nested.json', category: 'Nested JSON Examples', records: 1, description: 'One workspace object groups settings, notification preferences, and member records inside nested objects and arrays. Use it to learn how related settings and records can be organized or to test tree viewers and nested forms.', related: ['deeply-nested', 'users'], tool: 'json-tree-viewer' },
    { slug: 'schema-examples', name: 'JSON Schema Examples', file: 'schema-examples.json', category: 'JSON Schema Examples', records: 2, description: 'Two JSON Schema Draft 2020-12 documents demonstrate a closed object shape and an array whose items have typed properties. Use them as compact examples when learning schema structure or testing a schema validator.', related: ['api-success', 'api-error'], tool: 'json-schema-validator' },
    { slug: 'empty', name: 'Empty Array', file: 'empty.json', category: 'Testing and Edge Cases', records: 0, description: 'A valid JSON empty array contains no records. Use it to check how a tool or application handles zero results, empty lists, and boundary cases without confusing an empty collection with invalid JSON.', related: ['null-values', 'large-array'], tool: 'json-validator' },
    { slug: 'null-values', name: 'Null Values', file: 'null-values.json', category: 'Testing and Edge Cases', records: 1, description: 'One object deliberately combines explicit null values with zero, booleans, strings, and arrays. Use it to test nullable properties, distinguish null from missing or zero values, and explore JSON Schema requirements.', related: ['empty', 'deeply-nested'], tool: 'json-schema-generator' },
    { slug: 'deeply-nested', name: 'Deeply Nested JSON', file: 'deeply-nested.json', category: 'Testing and Edge Cases', records: 1, description: 'One organization-and-project object nests related information across several levels, including project details and child records. Use it to exercise recursive parsing, deep paths, tree expansion, and nested-data rendering.', related: ['nested', 'large-array'], tool: 'json-tree-viewer' },
    { slug: 'large-array', name: 'Large Record Array', file: 'large-array.json', category: 'Testing and Edge Cases', records: 30, description: 'Thirty compact fictional records share a consistent set of IDs, names, groups, boolean flags, and numeric scores. Use this larger array to test scrolling, search, pagination, performance, and JSON-to-table conversion.', related: ['pagination', 'empty'], tool: 'json-to-csv' },
  ],
  explanations: {
    users: {
      contains: [
        'Each record has a numeric id, display name, example.com email address, username, active boolean, and ISO-style joinedAt timestamp.',
        'The profile object groups city, timezone, and bio. Some bios are null and one contains text, demonstrating the difference between missing information and a supplied value.',
        'roles is an array because a person can have more than one role. preferences groups newsletter consent and theme selection.',
      ],
      useCases: 'Use this dataset to build a profile or account list, practice filtering active and inactive users, test nested profile rendering, and check how forms and schemas handle optional or null bio values.',
    },
    employees: {
      contains: [
        'Each employee has an employeeId, name, example.com email, jobTitle, and department.',
        'employment groups the employment type, startDate, and managerId. office groups city, country, and a remote boolean.',
        'skills is a string array, showing a one-to-many list attached to each employee.',
      ],
      useCases: 'Use it to prototype an employee directory, group staff by department or office, display remote status, or convert simple and nested staff fields into a table.',
    },
    products: {
      contains: [
        'Each product has an id, name, price, currency, and inStock boolean.',
        'category is a nested object with its own id, name, and parent category.',
        'tags is a string array. variants is an array of objects, each with a SKU, color, and available quantity.',
      ],
      useCases: 'Use it to build product cards or inventory lists, test category and tag filters, represent product variants, or inspect how a converter handles a mixture of nested objects and arrays.',
    },
    orders: {
      contains: [
        'Each order has an orderId, numeric customerId, status, createdAt timestamp, currency, and total.',
        'items contains multiple line-item objects. Each line item identifies a productId and records quantity and unitPrice.',
        'shipping groups the delivery method and trackingNumber, illustrating a nested object and a separate tracking identifier.',
      ],
      useCases: 'Use it to prototype order summaries, calculate or display line items and totals, filter by order status, or test conversion of transaction records into tables or SQL.',
    },
    posts: {
      contains: [
        'Each post has a numeric id, URL-friendly slug, title, body, published boolean, and publishedAt timestamp.',
        'author is a nested object containing the author id and name.',
        'tags is a string array, and commentCount is a numeric summary that can be compared with the separate comments sample.',
      ],
      useCases: 'Use it to build a blog or content feed, distinguish draft and published entries, create slug-based links, and test how nested authors and tag arrays render.',
    },
    comments: {
      contains: [
        'Each comment has a numeric id and postId to associate it with a post, plus a body and createdAt timestamp.',
        'author is a nested object with the commenter id and name; approved is a boolean moderation state.',
        'replyTo is null for a top-level comment in this sample, illustrating a nullable reference that could point to another comment.',
      ],
      useCases: 'Use it to prototype comment lists or moderation queues, associate comments with posts, and test nullable parent references and approval-state filters.',
    },
    'social-media': {
      contains: [
        'Each post has a postId, platform name, text, and createdAt timestamp.',
        'author groups the account handle and displayName. metrics groups numeric likes, reposts, and replies.',
        'hashtags is an array of strings. media is null in these examples, so consumers can test how a post without attached media should appear.',
      ],
      useCases: 'Use it to mock social feeds, show engagement totals, filter or display hashtags, and test optional media handling without connecting to a real platform.',
    },
    countries: {
      contains: [
        'Each country has a short code, name, capital, region, and numeric population.',
        'currency is a nested object with a code and readable name; languages is an array of language names.',
        'states contains state or region objects, each with a name and its own array of cities, forming a country-to-state-to-city hierarchy.',
      ],
      useCases: 'Use it to create cascading country, state, and city selectors; practice traversing hierarchical arrays; or test nested geographic data in a viewer or converter.',
    },
    books: {
      contains: [
        'Each book has an id, title, genre, publishedYear, and page count.',
        'author is a nested object with an author id and name. availableFormats is an array of supported format names.',
        'isbn is null in these fictional examples, so the data can be used to test unavailable identifiers without inventing real book identifiers.',
      ],
      useCases: 'Use it to prototype a library or book catalog, sort titles by publication year or length, display multiple formats, and test null identifiers.',
    },
    movies: {
      contains: [
        'Each film has an id, title, releaseYear, runtimeMinutes, numeric rating, and available boolean.',
        'genres and cast are arrays of strings, allowing a film to have multiple categories and performers.',
        'production is a nested object containing studio and country information.',
      ],
      useCases: 'Use it to build a fictional movie catalog, filter by genre or availability, show ratings and runtimes, and practice rendering cast arrays and production details.',
    },
    recipes: {
      contains: [
        'Each recipe has an id, name, servings count, prepMinutes value, and vegetarian boolean.',
        'ingredients is an array of objects with a name, numeric quantity, and unit. steps is an ordered array of instruction strings.',
        'allergens is null in these samples, providing a value that a real application would need to distinguish from an empty allergen list.',
      ],
      useCases: 'Use it to build recipe cards or cooking steps, scale quantities by servings, render repeated ingredient records, and test how unknown allergen information is handled.',
    },
    students: {
      contains: [
        'Each student has a studentId, name, example.com email, year of study, and enrolled boolean.',
        'courses is an array of course objects; each course has a code, title, and grade.',
        'advisor is a nested object with a name and example.com email address.',
      ],
      useCases: 'Use it to mock a student dashboard, list course enrollments and grades, filter enrollment status, and test nested advisor contact details.',
    },
    jobs: {
      contains: [
        'Each listing has a jobId, title, company, employmentType, applicationDeadline, and remote boolean.',
        'location groups city and country. salaryRange groups numeric minimum and maximum amounts with a currency code.',
        'skills is an array of requested skills, useful for matching a job with a candidate profile.',
      ],
      useCases: 'Use it to prototype job cards, filter by location or employment type, display salary ranges and deadlines, or test matching records against a list of skills.',
    },
    travel: {
      contains: [
        'Each booking has a bookingId and a destination object containing city, country, and countryCode.',
        'hotel groups the hotel name, numeric rating, and an amenities array.',
        'checkIn and checkOut hold stay dates; guests is a count, total groups amount and currency, and confirmed is a booking-state boolean.',
      ],
      useCases: 'Use it to mock a travel booking summary, display destinations and hotel amenities, calculate stay duration, and distinguish confirmed from unconfirmed reservations.',
    },
    weather: {
      contains: [
        'location groups city, region, and countryCode. observedAt records when the observation was taken, and conditions gives a short description.',
        'temperature contains a numeric value and unit. wind contains speed, unit, and direction.',
        'humidityPercent and precipitationMm are numeric measurements, allowing an interface to render readings with their units.',
      ],
      useCases: 'Use it to prototype weather cards or observation lists, practice displaying values with units, and test nested location and measurement objects.',
    },
    'api-success': {
      contains: [
        'success and status indicate whether the request succeeded and its illustrative HTTP-style status value; message provides a short human-readable result.',
        'data is an array of objects, each with an id, label, and enabled boolean. This represents the payload an application usually consumes.',
        'meta groups a requestId and servedAt timestamp so response metadata is kept separate from the returned data.',
      ],
      useCases: 'Use it to understand a common API response envelope, write sample client-side parsing code, and test access to a nested data array after checking the success state.',
    },
    'api-error': {
      contains: [
        'success is false and status contains an illustrative error status. error groups a machine-readable code and a human-readable message.',
        'error.fields is an array of field-level problems, each with a field name and an explanation of the issue.',
        'requestId supports tracing an example request; retryable indicates whether a client should consider retrying.',
      ],
      useCases: 'Use it to design error banners and field validation messages, distinguish machine-readable codes from user-facing text, and test retry decisions.',
    },
    pagination: {
      contains: [
        'data is the current page of records; each record in this example has a numeric id and name.',
        'pagination.page and pageSize describe the current slice, while totalItems and totalPages describe the full result set.',
        'hasPreviousPage, hasNextPage, previousPage, and nextPage provide explicit navigation state and page numbers.',
      ],
      useCases: 'Use it to implement or test a paginated list, verify next and previous controls, and keep page-level data separate from navigation metadata.',
    },
    nested: {
      contains: [
        'The root workspace object has an id and name, with lastUpdated at the root level as a timestamp.',
        'workspace.settings contains visibility and a nested notifications object with email and weeklyDigest boolean preferences.',
        'workspace.members is an array of member objects with numeric ids and role names.',
      ],
      useCases: 'Use it to learn how JSON objects can group related settings, test nested form layouts and tree viewers, and navigate to values several levels below the root.',
    },
    'schema-examples': {
      contains: [
        'The file is an array of two named examples; each example stores its JSON Schema document under schema.',
        'Both schemas declare the Draft 2020-12 dialect, an overall type, and properties with property-level types.',
        'required lists required property names, while additionalProperties controls whether keys outside the declared shape are allowed.',
      ],
      useCases: 'Use it to inspect common JSON Schema keywords and experiment with a validator. The schemas describe example JSON shapes; they are not application data records.',
    },
    empty: {
      contains: [
        'The entire document is an empty JSON array: [].',
        'There are zero array items, so the dataset record count is zero. The file is valid JSON and is not an empty file.',
      ],
      useCases: 'Use it to check empty-list handling, zero-result messages, and code that should accept a valid collection even when it has no elements.',
    },
    'null-values': {
      contains: [
        'The object has displayName and enabled values, a numeric score, and a labels array.',
        'middleName, lastSeenAt, and metadata are explicitly null. These keys exist but have no value in this example.',
        'score is zero and labels is an array, helping distinguish zero, null, and a collection as different JSON values.',
      ],
      useCases: 'Use it to test form controls, null handling, generated schemas, and application logic that must not treat zero or an empty array as equivalent to null.',
    },
    'deeply-nested': {
      contains: [
        'The document begins with organization, which contains a departments array.',
        'Each department contains teams; each team contains projects; each project contains milestones.',
        'A milestone has a name, a nested owner with name and example.com email, and a complete boolean.',
      ],
      useCases: 'Use it to test recursive algorithms, deeply nested JSONPath expressions, tree expansion, and user interfaces where a value is many levels below the root.',
    },
    'large-array': {
      contains: [
        'The top-level value is an array of 30 compact fictional records.',
        'Every record has a numeric id, a name, a group label, an active boolean, and a numeric score.',
        'The consistent record shape makes it straightforward to filter, sort, page, or convert the whole array into rows.',
      ],
      useCases: 'Use it as a small local performance and usability fixture for previews, search, scrolling, sorting, pagination, and JSON-to-CSV conversion; it is a sample, not a production-scale benchmark.',
    },
  },
};
