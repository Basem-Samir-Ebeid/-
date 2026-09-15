---
name: Online room target identity
description: Durable rule for synchronizing game actions when user-entered player names are not globally unique.
---

Online game actions must identify a target by its team and roster position, with the display name used only as a consistency check or event label.

**Why:** The default rosters and user-entered names can repeat across teams. Name-only lookup can reveal or update the wrong player's hidden state.

**How to apply:** Preserve team ownership and array position in client payloads and server validation. Keep hidden role data server-authoritative and merge responses by those indexes.