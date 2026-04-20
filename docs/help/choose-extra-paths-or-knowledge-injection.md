# Choose Extra Paths Or Knowledge Injection

When you want to bring more knowledge into ClawScope, there are two common options:

- **Extra paths**
- **Knowledge Injection**

They are related, but they do different jobs.

The short version:

- Use **Extra paths** when you want ClawScope to search an external folder.
- Use **Knowledge Injection** when you want a specific node to absorb a piece of knowledge into its own memory.

## Use extra paths when you want searchable external knowledge

**Extra paths** belong to the **Memory** module.

They tell ClawScope:

> "Also include this folder when you build recall and search."

Use extra paths when:

- your team already has a shared folder of Markdown notes, playbooks, or reference docs
- you want those files to become searchable
- you do **not** want to rewrite a node's own memory
- you want to keep the original files where they are

Think of **Extra paths** as:

- attaching an external knowledge shelf
- expanding where search can look
- managing retrieval sources, not editing memory truth

Extra paths are a good fit for:

- team playbooks
- shared product notes
- reusable troubleshooting guides
- read-only knowledge directories

Extra paths are **not** a good fit for:

- runtime cache folders
- `sessions/` or `qmd/` directories
- SQLite stores
- content that should become part of a node's own managed memory

## Use Knowledge Injection when you want the node to remember it

**Knowledge Injection** belongs to the **Evolution** module.

It tells ClawScope:

> "Take this structured knowledge package and write it into the selected node's memory."

Use Knowledge Injection when:

- you want one node to permanently learn a rule, workflow, or role-specific context
- you want to preview the change before applying it
- you want the action to appear in history and audit trails
- you want rollback support

Think of **Knowledge Injection** as:

- writing managed knowledge into the node
- turning a knowledge package into part of that node's memory state
- running a governed change, not just adding another search source

Knowledge Injection is a good fit for:

- operating rules
- role instructions
- domain-specific procedures
- curated summaries distilled from larger documents

## What is the difference?

| Question | Extra paths | Knowledge Injection |
|---|---|---|
| What does it do? | Adds an external folder to recall and search | Writes a managed knowledge block into the selected node's memory |
| Which module owns it? | **Memory** | **Evolution** |
| Does it change the node's memory content? | No | Yes |
| Does it need preview / execute / rollback? | No | Yes |
| What is it best for? | Shared searchable documents | Node-specific long-term knowledge |
| What should you expect? | "Search can see this folder" | "This node now remembers this knowledge" |

## Where they overlap

Both features can improve later search results.

That is where the overlap ends.

They do **not** work the same way:

- **Extra paths** change the search scope
- **Knowledge Injection** changes the node's memory content

At the moment, ClawScope does **not** automatically sync the two:

- adding an extra path does **not** create a knowledge injection task
- running a knowledge injection does **not** automatically add its source folder to extra paths

## Recommended workflow

If you are not sure which one to use, start here:

1. Put the full reference material in a shared folder.
2. Add that folder through **Extra paths** so it becomes searchable.
3. Watch how useful the material is in practice.
4. If part of it should become durable node knowledge, turn the key parts into a smaller knowledge package.
5. Apply that package with **Knowledge Injection**.

This gives you a clean split:

- the full source stays external
- the most important rules get written into the node's memory

## Avoid duplicate knowledge on both sides

You can use both features together, but avoid copying the same long document into both places unchanged.

If you:

- add the full document through **Extra paths**
- and inject the same full document into node memory

you may end up with duplicated recall hits and harder-to-read search results.

A better pattern is:

- keep the full document in **Extra paths**
- inject only the distilled summary, rules, or final operating guidance

## FAQ

### Does Knowledge Injection write to `MEMORY.md`?

Yes, in most cases it does.

More precisely, **Knowledge Injection** writes to the node's **root memory document**:

- ClawScope uses `MEMORY.md` first
- if `MEMORY.md` is not available, it falls back to `memory.md`

This means Knowledge Injection does **not**:

- write into an extra path folder
- create a separate external knowledge database entry
- store the knowledge only as a search source

Instead, it appends a managed knowledge block into the selected node's root memory document, and that content later becomes searchable through the normal memory indexing flow.

## Quick decision guide

Choose **Extra paths** if your question is:

- "How do I make this folder searchable?"
- "How do I let multiple nodes search the same knowledge base?"
- "How do I include shared docs without editing node memory?"

Choose **Knowledge Injection** if your question is:

- "How do I make this node remember this?"
- "How do I apply a knowledge package with preview and rollback?"
- "How do I turn a source document into managed node memory?"

## One-line summary

- If you want ClawScope to **search it**, use **Extra paths**.
- If you want a node to **remember it**, use **Knowledge Injection**.
