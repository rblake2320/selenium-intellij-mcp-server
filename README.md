# Selenium + IntelliJ MCP Server

A comprehensive MCP (Model Context Protocol) server that unifies **Selenium WebDriver browser automation**, **Selenium Grid 4 management**, **JUnit/TestNG test execution**, **Page Object Model scaffolding**, **Selenium IDE-style recording**, and **IntelliJ IDEA integration** into a single tool suite.

**72 tools** across 6 categories — designed for AI agents that orchestrate Java/Selenium test automation workflows.

## Quick Start

```bash
git clone https://github.com/rblake2320/selenium-intellij-mcp-server.git
cd selenium-intellij-mcp-server
npm install
npm run build
node dist/index.js
```

## Configuration

### Claude Code — add to `.mcp.json`

```json
{
  "mcpServers": {
    "selenium-intellij": {
      "command": "node",
      "args": ["/absolute/path/to/selenium-intellij-mcp-server/dist/index.js"],
      "env": {
        "SELENIUM_GRID_URL": "http://localhost:4444",
        "INTELLIJ_REST_PORT": "63342",
        "INTELLIJ_MCP_PORT": "29170"
      }
    }
  }
}
```

### Claude Desktop — add to `claude_desktop_config.json`

Same JSON block as above, placed inside the `mcpServers` key.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SELENIUM_GRID_URL` | `http://localhost:4444` | Selenium Grid 4 hub URL |
| `INTELLIJ_REST_PORT` | `63342` | IntelliJ built-in REST API port |
| `INTELLIJ_MCP_PORT` | `29170` | IDE Index MCP plugin HTTP port |

## Tool Categories (72 total)

### Selenium WebDriver (42 tools)

**Session Management:** `selenium_create_session`, `selenium_close_session`, `selenium_list_sessions`

**Navigation:** `selenium_navigate`, `selenium_back`, `selenium_forward`, `selenium_refresh`, `selenium_get_url`, `selenium_get_title`, `selenium_get_page_source`

**Element Interactions:** `selenium_click`, `selenium_double_click`, `selenium_right_click`, `selenium_hover`, `selenium_type`, `selenium_send_keys`, `selenium_select_by_value`, `selenium_select_by_text`, `selenium_upload_file`, `selenium_drag_and_drop`, `selenium_scroll_to_element`, `selenium_scroll_by`

**Element Reading:** `selenium_get_text`, `selenium_get_attribute`, `selenium_get_element_info`, `selenium_find_elements`, `selenium_is_element_present`

**Waits:** `selenium_wait_for_element`, `selenium_wait_for_element_visible`

**Screenshots:** `selenium_screenshot`

**JavaScript:** `selenium_execute_script`

**Cookies:** `selenium_get_cookies`, `selenium_add_cookie`, `selenium_delete_cookie`, `selenium_delete_all_cookies`

**Frames:** `selenium_switch_to_frame`, `selenium_switch_to_default_content`

**Windows/Tabs:** `selenium_get_window_handles`, `selenium_switch_to_window`, `selenium_new_tab`, `selenium_set_window_size`, `selenium_maximize_window`

**Alerts:** `selenium_accept_alert`, `selenium_dismiss_alert`

**Console:** `selenium_get_console_logs`

### Selenium Grid 4 (4 tools)

`grid_status`, `grid_sessions`, `grid_available_browsers`, `grid_queue_size`

### Test Execution (3 tools)

`test_run`, `test_discover`, `test_check_build_tool`

Supports JUnit 4, JUnit 5, and TestNG via Maven or Gradle. Parses Surefire/Failsafe XML reports.

### Page Object Model (3 tools)

`pom_generate_page_object`, `pom_generate_test_class`, `pom_from_live_page`

Generates Java classes with `@FindBy` annotations and interaction methods per element type.

### Recording (7 tools)

`recording_start`, `recording_stop`, `recording_add_action`, `recording_list`, `recording_get`, `recording_export_java`, `recording_export_side`

Selenium IDE-style recording with export to Java test code and `.side` JSON format.

### IntelliJ IDEA (13 tools)

`intellij_status`, `intellij_mcp_status`, `intellij_open_file`, `intellij_get_errors`, `intellij_find_definition`, `intellij_find_references`, `intellij_find_implementations`, `intellij_search_symbol`, `intellij_type_hierarchy`, `intellij_call_hierarchy`, `intellij_rename`, `intellij_run_configuration`, `intellij_get_run_configs`, `intellij_get_project_info`

## Architecture

```
src/
├── index.ts                     # MCP server entry — all 72 tools registered
├── constants.ts                 # Shared constants, literal union types
├── types.ts                     # TypeScript interfaces
└── services/
    ├── selenium-service.ts      # WebDriver session management & commands
    ├── grid-service.ts          # Grid 4 REST/GraphQL client
    ├── intellij-service.ts      # IntelliJ REST + MCP plugin HTTP client
    ├── test-runner-service.ts   # Maven/Gradle test execution & XML parsing
    ├── pom-service.ts           # Page Object Model class generation
    └── recording-service.ts     # IDE-style recording & export
```

## Prerequisites

- **Node.js 18+**
- **Chrome/Firefox/Edge** + matching WebDriver (for Selenium tools)
- **Selenium Grid 4** (optional — for grid management tools)
- **IntelliJ IDEA 2024.3+** with IDE Index MCP plugin (optional — for IDE tools)
- **Maven or Gradle** (optional — for test execution tools)

## License

MIT
