---
checked: 2026-10-06
recheck: "6m. If Discourse removes the EXPERIMENTAL mark of registerRichEditorExtension, or adds a markdown API for theme components, recheck at that time"
decisions:
  - "2026-10-06, user: a Discourse plugin (option B with a rich editor extension), not a theme component, because the goal is tbl as if native, also in emails, search, and the rich editor. See docs/PLAN.md, steps 16 and later"
---

# Discourse integration for tbl blocks

Research on 2026-10-06 for the item "A Discourse plugin or theme component for `tbl` tables" in `docs/PLAN.md`, section Later. No paid API. No key file was read.

This report uses ASD-STE100 Simplified Technical English as a guide. No tool can make sure that a text obeys ASD-STE100 fully.

Marks:

- "[source N]" points to the list at the end.
- "[file]" is a file in a snapshot of `discourse/discourse` `main`, commit `f18a198` of 2026-10-06. This research read the file.
- "[measured]" is a fact that this research measured on this machine.
- "[guess]" is a statement without a source. Test it before a decision rests on it.

Related report: `~/dv/markgraf/docs/research/discourse-editor-schema.md` (2026-10-03). It describes the rich editor extension API, the ProseMirror parse and serialize steps, and the GPL-2.0 license of Discourse. This report does not copy it.

## Question

How can a Discourse forum show a fenced `tbl` block in a post as an HTML table? How can the composer give the writer `tbl`? The five sub-questions are in the sections 1 to 5.

## Short answer

```tbl
q: Question
a: Answer
--
q: 1. Plugin or theme component
a: Only a plugin changes the markdown-it pipeline. The server cooks each post in mini_racer, and it loads only the `discourse-markdown/` files of plugins. A theme component can only change the cooked HTML in the browser with `api.decorateCookedElement`. Then emails, the search index, excerpts, and oneboxes see the raw `tbl` source as a code block.
--
q: 2. Hosting
a: Self-hosted: each plugin. Communiteq: a plugin of your choice on Business and Enterprise. discourse.org: a custom plugin only on Enterprise (or as an add-on), after a code review. Each host allows each theme component.
--
q: 3. Examples
a: The Mermaid theme component decorates the code fence ```` ```mermaid ```` on the client. The plugins discourse-math, discourse-graphviz, and discourse-chart add a markdown rule on the server. The rule writes the source into a `div`, and the client draws it. Each plugin also adds a rich editor extension and a composer menu item.
--
q: 4. Composer
a: `api.addComposerToolbarPopupMenuOption` adds a menu item, and `toolbarEvent.applySurround` inserts a fence. If the plugin makes new token types, the rich editor needs extra work. Else it needs none. A plain ```` ```tbl ```` fence stays a code block in the rich editor with no extra work.
--
q: 5. Reuse of npm code
a: `helper.registerPlugin(md => ...)` takes any markdown-it plugin function. But the server loads each plugin file one by one, with no npm resolution. Thus the code must be one bundled file in the plugin, with no `node:` modules. The parser of tbl-md bundles to 10 KB with no `node:` module [measured].
```

## 1. Plugin or theme component

### The cooking pipeline

Discourse renders Markdown with markdown-it [source 1]. It "cooks" each post twice:

- On the server, `PrettyText` runs the same JavaScript engine in a mini_racer (V8) context. The cooked HTML goes into the database (`posts.cooked`). Each reader gets this HTML [file `lib/pretty_text.rb`, lines 59 to 123].
- In the browser, the composer preview runs the engine again [file `frontend/discourse/app/static/markdown-it/index.js`].

The server context loads the core bundle, and then each file that matches `<plugin>/assets/javascripts/**/discourse-markdown/**/*.js` of each plugin [file `lib/pretty_text.rb`, lines 103 to 115]. The client loads each module of a plugin whose name has `/discourse-markdown/` or `/markdown-it/` [file `frontend/discourse/app/static/markdown-it/features.js`]. The client filter starts with `discourse/plugins/`. Thus a theme module never becomes a markdown feature.

The plugin API of themes has no method to add a markdown rule [file `frontend/discourse/app/lib/plugin-api.gjs`]. The theme compiler has no markdown hook [file `lib/theme_javascript_compiler.rb`]. Discourse staff wrote the same on meta: a markdown-it extension must be a plugin, and Sam Saffron wrote "Markdown it extensions can be repackaged as discourse plugins just fine" (2018-03-24) [source 2].

Result: only a plugin changes the cooked HTML. A theme component changes the HTML only in the browser, after the cook.

### What a plugin needs

A markdown file of a plugin exports `setup(helper)` [source 1] [file `plugins/discourse-graphviz/assets/javascripts/discourse-markdown/discourse-graphviz.js`]:

- `helper.registerOptions((opts, siteSettings) => ...)` turns the feature on or off by a site setting.
- `helper.allowList([...])` adds HTML tags and attributes to the sanitizer. The sanitizer removes each tag and attribute that no feature allows.
- `helper.registerPlugin((md) => ...)` gets the markdown-it instance. In it, the plugin adds rules and renderer rules.

The core table feature already allows the table tags and `div.md-table` [file `frontend/discourse-markdown-it/src/features/table.js`]. It also allows `style="text-align:left|center|right"` on `th` and `td`. Thus a tbl plugin gets the GFM look and the alignment with no new allow entries. A class or an ID from a tbl attribute (rule 13 of `docs/format.md`) needs an allow entry. The core code feature shows that a wildcard works: `pre[data-code-*]` [file `frontend/discourse-markdown-it/src/features/code.js`].

`plugin.rb` needs only the metadata, `enabled_site_setting`, and `register_asset` for a stylesheet. JavaScript files under `assets/javascripts` load automatically. `register_asset` for such a file is an error [file `lib/plugin/instance.rb`, lines 830 to 848]. `register_asset "<file>.js", :vendored_pretty_text` evaluates a plain script in the server context [file `lib/discourse_plugin_registry.rb`, line 210].

### What only client-side decoration gives

A fence ```` ```tbl ```` with no plugin cooks to `<pre data-code-wrap="tbl"><code class="lang-tbl">…source…</code></pre>` [file `frontend/discourse-markdown-it/src/features/code.js`]. A theme component finds `pre[data-code-wrap=tbl]` in `api.decorateCookedElement` and puts a table in its place. The decorators also run on the composer preview [file `frontend/discourse/app/components/composer-editor.gjs`, line 483]. Each other consumer reads the stored HTML or the raw text:

```tbl
use: Consumer
reads: What it reads
client: Result with client-side decoration only
--
use: Email notifications and the mailing list mode
reads: The cooked HTML, through `PrettyText.format_for_email` [file `lib/pretty_text.rb`, line 707]
client: The reader sees the `tbl` source in a code block. The source is readable, but it is no table.
--
use: Search index
reads: The cooked HTML, with the tags removed [file `app/services/search_indexer.rb`, lines 189 to 202]
client: The index holds the keys and the separators (`model:`, `--`) and the cell text. Search finds the cell text. The words of the titles are on each key line only once, in the header.
--
use: Excerpts (topic list, link previews, oneboxes of a topic, notifications)
reads: The cooked HTML, through `ExcerptParser` [file `lib/pretty_text.rb`, line 475]
client: The excerpt shows the source text of the block.
--
use: AI topic summary (discourse-ai)
reads: The raw Markdown (`posts.raw`) [file `plugins/discourse-ai/lib/summarization/strategies/topic_summary.rb`, line 23]
client: No change. The model reads the `tbl` source in both cases.
--
use: Readers with JavaScript off, crawlers, the print view
reads: The cooked HTML
client: The source in a code block.
--
use: Chat
reads: Its own decorator `api.decorateChatMessage`
client: If the component also decorates chat messages, chat shows a table. Mermaid does this [source 4].
```

With a plugin that cooks on the server, each consumer in this table gets a real HTML table. The AI summary reads the raw text in both cases.

## 2. Hosting limits

```tbl
host: Host and plan
plugins: Own plugin
themes: Theme component
--
host: Self-hosted (the official Docker install)
plugins: Yes, each plugin
themes: Yes
--
host: discourse.org Free and Starter
plugins: No. Only the plugins of the plan
themes: Yes, custom themes and components [source 5]
--
host: discourse.org Pro ($100 a month) and Business ($500 a month)
plugins: No. Pro has "15+ plugins" and Business "35+" from a fixed list [source 5]. Staff wrote that custom plugins are not possible on these plans, because the sites share a multisite server (2016, 2020, 2022) [source 6]
themes: Yes
--
host: discourse.org Enterprise (custom price)
plugins: Yes, after a code review by staff, and maybe with a maintenance fee (2022-03-22) [source 6]. The pricing page lists "Unofficial & custom plugins" as an add-on with no price [source 5]
themes: Yes
--
host: Communiteq Basic
plugins: No [source 7]
themes: Yes, "no restrictions and there is no limit" [source 7]
--
host: Communiteq Professional
plugins: Up to five plugins from the Discourse team, Pavilion, or Communiteq [source 7]
themes: Yes
--
host: Communiteq Business and Enterprise
plugins: Yes, "any plugin of your choice" [source 7]
themes: Yes
```

Result: a theme component reaches each Discourse forum. A plugin reaches a self-hosted forum, a Communiteq Business or Enterprise forum, and a discourse.org Enterprise forum. A plugin reaches the Pro and Business plans of discourse.org only if Discourse adds it to its own list.

## 3. Examples

```tbl
name: Example
kind: Kind
syntax: Syntax
how: How it renders
why: Why (from the code)
--
name: discourse-mermaid-theme-component (MIT, last commit 2026-06-04) [source 4]
kind: Theme component
syntax: ```` ```mermaid ```` fence
how: `api.decorateCookedElement` finds `pre[data-code-wrap=mermaid]` and draws an SVG in the browser. The Mermaid library is a theme asset. A menu item inserts a sample fence. It has no rich editor extension.
why: A diagram needs a browser library. A theme reaches each hosted plan. The core fence already keeps the source.
--
name: discourse-graphviz (in the core repository since 2026)
kind: Plugin
syntax: `[graphviz engine=dot]…[/graphviz]` BBCode
how: A block BBCode rule writes `<div class="graphviz is-loading" data-engine="dot">source</div>`. The client draws the SVG. A migration of 2026-06-10 ("make graphviz frontend only") removed the server SVG and rebakes the posts. It has a rich editor extension and a menu item.
why: The plugin owns the syntax and the allow list. The drawing moved to the client, so the server no longer runs viz.js.
--
name: discourse-math (in the core repository)
kind: Plugin
syntax: `$…$` and `$$…$$`
how: Inline and block rules write `<span class="math">` and `<div class="math">` with the escaped source. The client renders with MathJax or KaTeX. It has a rich editor extension and a menu item.
why: The `$` syntax is no fence, so only a markdown rule finds it.
--
name: discourse-chart (Discourse team, last commit 2026-09-01) [source 8]
kind: Plugin
syntax: `[chart type=line …]` around a pipe table
how: A block BBCode rule writes `div.discourse-chart` with the rows. The client draws with Chart.js. On `reduce_cooked`, the server replaces the chart with a link in emails. It has a rich editor extension, a menu item, and a builder modal.
why: It is the closest example for tbl: table data in a post, a server rule, a client view, and an email fallback.
--
name: discourse-table-builder (archived 2025-04-09) [source 9]
kind: Theme component, now in core
syntax: GFM pipe table
how: A modal edits a GFM table and writes it back into the composer.
why: It shows that Discourse treats the GFM table as its table format, also in the core editor.
```

The pattern of the Discourse team in 2026: a plugin owns the syntax and the sanitizer, the server writes neutral HTML with the source, and the client adds the rich view. For tbl, the rich view is the HTML table itself, so the server can write the final table. No client step is necessary.

## 4. The composer

### Markdown mode

- `api.addComposerToolbarPopupMenuOption({ icon, label, action })` adds an item to the "+" menu. The action gets a `toolbarEvent` with `applySurround(head, tail, sampleKey)` and `addText(text)` [file `frontend/discourse/app/lib/plugin-api.gjs`, lines 1146 to 1174]. Mermaid, graphviz, math, and chart use it [source 4] [file graphviz initializer].
- `api.onToolbarCreate(toolbar => toolbar.addButton({...}))` adds a button to the toolbar itself [file `plugin-api.gjs`, line 1122].
- A theme can do both. `applySurround` expects a key in the top level `composer` namespace. A theme cannot add such a key. Thus the Mermaid component sets the translation key by hand [source 4].

A converter "GFM table to tbl" is a menu action: it reads the selected text with `toolbarEvent`, runs `convert(text, { to: "tbl" })`, and writes the result with `addText`. The `convert` function of tbl-md bundles to 119 KB minified and 34 KB with gzip for the browser [measured]. It has no `node:` module [measured]. A theme component can carry this bundle as an asset, as Mermaid carries its library.

### Rich text editor (ProseMirror)

The rich editor parses the Markdown with the same Discourse markdown-it engine and all plugin features [file `frontend/discourse/app/static/prosemirror/lib/markdown-it.js`]. Then it maps each token to a ProseMirror node. On save, it serializes the document back to Markdown. Three cases follow:

```tbl
case: What the tbl feature makes
editor: What the rich editor does
--
case: No plugin (theme only). The fence stays a `fence` token
editor: The block becomes a `code_block` node with the language `tbl`. It saves back as a fence. The writer sees the source, not a table. No extra work.
--
case: A plugin that changes only the fence renderer. The token stays `fence`
editor: The same as above. The rich editor reads tokens, not HTML, so it never sees the table.
--
case: A plugin that makes new token types, for example `tbl`
editor: The parser has no handler, so it throws `UnsupportedTokenError`. The editor shows an alert and switches back to the Markdown mode [file `frontend/discourse/app/static/prosemirror/core/parser.js`, lines 40 to 49]. The plugin must add a rich editor extension with `api.registerRichEditorExtension` (`nodeSpec`, `parse`, `serializeNode`), as graphviz and chart do.
--
case: A plugin that makes the core table tokens (`table_open`, `tr_open`, …)
editor: The rich editor makes a table node. On save, the table serializer writes a GFM pipe table [file `frontend/discourse/app/static/prosemirror/extensions/table.js`, lines 129 to 175]. Thus one edit in the rich editor silently turns the tbl block into a GFM table. Do not use this case.
```

The extension API has the mark "EXPERIMENTAL: This API will change without warning" [file `plugin-api.gjs`, line 3671]. Graphviz and chart use the helpers `previewSourceNode` and `PreviewNodeView`: the writer edits the source, and a preview shows the result [file `frontend/discourse/app/lib/composer/preview-block.js`]. A tbl extension can use the same pattern: a `tbl` node that holds the source, shows the table as a preview, and serializes back to a ```` ```tbl ```` fence. The fence length must follow the canonical form of `docs/format.md`.

## 5. Reuse of a generic markdown-it plugin

`helper.registerPlugin(func)` calls `func(md)` with the markdown-it instance [source 1]. Thus `helper.registerPlugin((md) => md.use(tblPlugin))` works for a plugin function that uses only the markdown-it API. Four limits apply:

1. **No npm resolution.** On the server, Discourse transpiles each `discourse-markdown` file alone and evaluates it in V8 [file `lib/pretty_text.rb`, lines 34 to 39]. An import resolves only to the modules in that context: other plugin markdown modules and the core bundle. The core bundle exports eight Discourse modules, for example `discourse/lib/case-converter` [file `lib/pretty_text/core_bundle.rb`]. The plugins of the Discourse team have no runtime npm dependencies in `package.json`. They carry their libraries as files, for example `public/javascripts/viz-3.0.1.js` in graphviz [file]. Thus the tbl code must be one bundled ES module in the `discourse-markdown/` folder, or a plain script with `register_asset …, :vendored_pretty_text`. [guess] A bundled ES module with one `export` of `setup` and no imports is the safest form. Test it in a dev instance.
2. **No `node:` modules and no browser API.** The server context is plain V8 with no Node API and no DOM. The tbl-md parser (`src/parse.ts`, `src/attributes.ts`, `src/syntax.ts`) bundles to 10 KB with no `node:` module [measured]. The code rule of tbl-md ("only `node:` modules and its libraries, no Bun API") already keeps `node:` out of these files. Only `src/config.ts` and `src/cli.ts` use `node:` modules.
3. **The Discourse fence renderer.** The core code feature sets `md.renderer.rules.fence` [file `features/code.js`, line 91]. The features run in order of `priority` [file `frontend/discourse-markdown-it/src/setup.js`, line 21]. A generic plugin that wraps `rules.fence` must run after the core feature, or the core feature replaces it. [guess] A core rule that replaces the `fence` token by an own token type is more robust, because it does not depend on the renderer order. But then the rich editor needs an extension (section 4).
4. **Inline Markdown in cells.** Rule 11 of `docs/format.md` makes cell text inline Markdown. The plugin must give each cell to the Discourse inline parser (for example with inline tokens or `md.renderInline`), so that mentions, emoji, links, and the sanitizer apply. [guess] `md.renderInline` runs the Discourse inline rules. Test mentions and emoji in a dev instance.

## Options for tbl-md

```tbl
opt: Option
gives: What it gives
cost: What it costs
--
opt: A. Theme component, decoration only
gives: A table in the post view, the composer preview, and chat, on each host. A menu item and a GFM-to-tbl converter.
cost: Email, search, excerpts, oneboxes, and readers with no JavaScript see the source. A short flash of the code block before the decoration.
--
opt: B. Plugin, server rule with an own token, plus a rich editor extension
gives: A real table in each consumer. The source stays the stored text. The rich editor shows a source and a preview.
cost: Only self-hosted, Communiteq Business, and discourse.org Enterprise forums. The rich editor API is experimental. More code and tests (a Discourse dev instance for system specs).
--
opt: C. Both, from one bundle
gives: Option A on each host, option B where a plugin is possible. The same parser and renderer code.
cost: Two packages to keep up to date with Discourse releases.
```

[guess] Option C fits the goal of tbl-md best. The theme component is the first version (value "deliver first"). When a forum that allows plugins needs email and search, the plugin follows.

## Critical analysis

1. **The premises of the question.** The question assumes that the forum stores `tbl` as the source of truth. Discourse treats the GFM pipe table as its table format: the core table builder and the rich editor table both write GFM. A `tbl` block in Discourse thus works against the editor of the platform. The question also assumes that the writer edits Markdown text. Many writers on Discourse use the rich editor, and they never see the source. For them, the problem "a pipe table is hard to edit as text" does not exist. The real problem on Discourse is narrower: writers in the Markdown mode, and agents that post through the API.
2. **The standard solution and its control mechanisms.** The standard solution is a GFM table, edited with the table builder or the rich editor. The control is in the hand of Discourse (CDCK): it decides the markdown engine, the sanitizer, the editor schema, and which plugins the hosted plans allow. The plugin path depends on an API with the mark "EXPERIMENTAL". On discourse.org hosting, a plugin needs the Enterprise plan or a review and a fee. This is a platform gate, not a technical gate.
3. **The autonomous alternatives.** Self-hosted Discourse (GPL-2.0) and Communiteq allow each plugin. A theme component works on each host and needs no approval. Outside Discourse, a static site or a forum with a CommonMark engine shows `tbl` with no gate. An example is a remark or markdown-it pipeline that tbl-md controls. The `tbl-md convert --to gfm` command is the exit path: a forum post converts back to a GFM table with no loss.
4. **The cost of autonomy.** A self-hosted Discourse needs a server, updates, backups, and email setup: hours each month. A plugin must follow each Discourse release, because the rich editor API changes without warning. The Discourse team keeps a `.discourse-compatibility` file in each plugin for this reason [source 8]. A theme component costs less, but it gives up email, search, and excerpts. These costs fall on the maintainer of tbl-md, not on the forum admin.

## Sources

Each source was read on 2026-10-06.

1. Discourse developer docs, "Developer's guide to Markdown extensions", `discourse/discourse-developer-docs`, file `docs/03-code-internals/09-markdown-extensions.md`. https://github.com/discourse/discourse-developer-docs/blob/main/docs/03-code-internals/09-markdown-extensions.md
2. meta.discourse.org, "No way to install markdown-it plugins?", posts of 2018-03-23 to 2018-04-05. https://meta.discourse.org/t/no-way-to-install-markdown-it-plugins/83686
3. Discourse source, `discourse/discourse` `main`, commit `f18a1985b22e5d4c0a0fffd6f91812105467afdb` (2026-10-06). The "[file]" marks point into it. https://github.com/discourse/discourse
4. `discourse/discourse-mermaid-theme-component`, MIT, last commit 2026-06-04, file `javascripts/discourse/api-initializers/discourse-mermaid-theme-component.js`. https://github.com/discourse/discourse-mermaid-theme-component. Topic: https://meta.discourse.org/t/discourse-mermaid/218242
5. Discourse hosting plans. https://www.discourse.org/pricing
6. meta.discourse.org, three topics:
   - "How to install a plugin on Discourse-hosted-Discourse?" (2016-04-18, mpalmer). https://meta.discourse.org/t/how-to-install-a-plugin-on-discourse-hosted-discourse/42783
   - "Development life cycle with Discourse hosting" (2020-09-22, simon). https://meta.discourse.org/t/development-life-cycle-with-discourse-hosting/164999
   - "Discourse Hosting Limits?" (2022-03-22, awesomerobot). https://meta.discourse.org/t/discourse-hosting-limits/221587
7. Communiteq, "Discourse Hosting Frequently Asked Questions". https://www.communiteq.com/discoursehosting/faq/
8. `discourse/discourse-chart`, last commit 2026-09-01, files `plugin.rb`, `assets/javascripts/discourse-markdown/discourse-chart.js`, `assets/javascripts/discourse/lib/rich-editor-extension.js`, `.discourse-compatibility`. https://github.com/discourse/discourse-chart
9. `discourse/discourse-table-builder`, archived, last push 2025-04-09, README: "bundled into core Discourse". https://github.com/discourse/discourse-table-builder
10. skills.sh search API, queries `discourse`, `discourse plugin`, `discourse theme`, `markdown-it`. No skill covers Discourse plugin or theme development. The hits are API integration skills (for example `membranedev/application-skills/discourse`). https://www.skills.sh/api/search?q=discourse
11. The Discourse repository has its own agent skills in `.skills/`, for example `discourse-frontend-conventions` and `discourse-writing-js-tests`. None covers markdown extensions. https://github.com/discourse/discourse/tree/main/.skills
