# @groowooth/mcp

`@groowooth/mcp` is the MCP server for groowooth. It exposes child growth assessment, chart rendering, and percentile interpretation as AI-callable tools over stdio, using the shared `@groowooth/core` engine under the hood.

The package is intended for MCP clients such as Claude Desktop, Cursor, and Cline. It is stateless: every request carries the measurement data it needs, and the server does not persist child records.

## Install

```bash
npm i -g @groowooth/mcp
```

```bash
npx @groowooth/mcp
```

For a local clone of this repository, build first because the bin entry loads `dist/server.js`:

```bash
pnpm --filter @groowooth/mcp build
node packages/mcp/bin/groowooth-mcp.js
```

## Tools

`assess_growth` evaluates one child measurement snapshot against WHO or NHC growth standards and returns structured JSON with z-scores, percentiles, range labels, standard metadata, and the shared medical disclaimer. It is the main tool for turning raw age, sex, height, weight, and head circumference inputs into comparable growth indicators without adding clinical diagnosis wording.

`get_growth_chart` renders an SVG growth chart from measurement history and returns the chart markup directly as MCP text content. The result includes percentile curves and plotted child data points, which makes it suitable for clients that can display or save SVG returned by a tool call.

`interpret_growth` translates a z-score into parent-friendly Chinese statistical language and returns JSON with the description, range label, and disclaimer. It is useful when an AI client already has a z-score from prior computation and needs a concise explanation without action advice or diagnostic phrasing.

## Claude Desktop

```json
{
  "mcpServers": {
    "groowooth": {
      "command": "npx",
      "args": ["-y", "@groowooth/mcp"]
    }
  }
}
```

## Cursor / Cline

Cursor and Cline both support stdio MCP servers with the same basic pattern: point the client at `npx -y @groowooth/mcp`, or at a locally installed `groowooth-mcp` binary if you prefer a fixed runtime path. If you are running from this repository checkout instead of the published package, build `packages/mcp` first so the bin script can import `dist/server.js`.

## License

MIT
