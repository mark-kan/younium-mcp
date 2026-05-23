# younium-mcp

MCP server for the [Younium](https://younium.com) subscription management API. Exposes all 159 Younium API operations as tools for Claude Desktop and other MCP clients.

## Setup for Claude Desktop

1. Find your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the `younium` entry to `mcpServers` (merge with any existing config):

```json
{
  "mcpServers": {
    "younium": {
      "command": "npx",
      "args": ["-y", "younium-mcp"],
      "env": {
        "YOUNIUM_CLIENT_ID": "your-client-id",
        "YOUNIUM_SECRET": "your-client-secret"
      }
    }
  }
}
```

3. Restart Claude Desktop. You should now be able to ask things like:
   - "List all active subscriptions in Younium"
   - "Get account details for customer X"
   - "Show me invoices from the past 30 days"
   - "Create a new quote for account Y"

## Credentials

| Env var | Description |
|---|---|
| `YOUNIUM_CLIENT_ID` | API token client ID (from Younium → Settings → API Tokens) |
| `YOUNIUM_SECRET` | API token secret |
| `YOUNIUM_LEGAL_ENTITY` | *(optional)* Legal entity ID for multi-tenant setups |

## Available tools

All 159 Younium API v2.1 endpoints are exposed. Resources include:

- **Accounts** — CRUD, payment details, GoCardless/Stripe requests
- **Subscriptions** — CRUD, amend, cancel, move, charge
- **Invoices** — list, get, create, post, void, credit notes
- **Payments** — list, get, create, post
- **Products / SimpleProducts** — CRUD
- **Orders / SalesOrders** — CRUD, charges, versions
- **Quotes** — CRUD, convert to order
- **Reports** — list, get data
- **Usage / Measurements** — list, get, import
- **Webhooks** — list, get, create, delete
- **Users** — list, get, invite, deactivate
- **Journals** — list, get, book, reverse
- And more: Bookings, Metrics, ChartOfAccounts, Currency, PaymentTerms, TaxTemplates, etc.

## Requirements

- Node.js 18+
