# Changelog

## [0.4.1](https://github.com/thoka/tbl-md/compare/v0.4.0...v0.4.1) (2026-10-07)


### Bug Fixes

* print the doctor JSON in the shared doctor format, and check it in the pre-push hook (step 24) ([d9511c3](https://github.com/thoka/tbl-md/commit/d9511c3b7791f87b5aa65878e18102914b4c64c4))

## [0.4.0](https://github.com/thoka/tbl-md/compare/v0.3.0...v0.4.0) (2026-10-07)


### Features

* add mise run doctor for the command, the skill links, and the git hooks (step 23) ([84487bc](https://github.com/thoka/tbl-md/commit/84487bc670cbc25691214de1c2a1b1d7c06899a2))
* ship an Agent Skill that tells agents to write tables as tbl blocks (step 22) ([bae1956](https://github.com/thoka/tbl-md/commit/bae1956bbfae43d8e72e1f2f39aa2117d1f3a626))

## [0.3.0](https://github.com/thoka/tbl-md/compare/v0.2.0...v0.3.0) (2026-10-06)


### ⚠ BREAKING CHANGES

* markdown-it as the only parser, with the option flavor (step 18a)
* the pipe rule and the trim of format 0.3.0 in fromGfm and toGfm
* findTables reads Markdown with markdown-it

### Features

* findTables reads Markdown with markdown-it ([3ab4543](https://github.com/thoka/tbl-md/commit/3ab4543fe2d2b3eaec5cc88136a5b74ea5ab76f1))
* markdown-it as the only parser, with the option flavor (step 18a) ([6cff714](https://github.com/thoka/tbl-md/commit/6cff71419f7cbb99db03217998e37bf610d5bb11))
* mise run corpus-markdown-it compares markdown-it and micromark on the corpus ([012062c](https://github.com/thoka/tbl-md/commit/012062cb373372ed960a38d34cdc9abe6442d39c))
* the CLI flag --flavor and the configuration key flavor (step 18d) ([eeea94f](https://github.com/thoka/tbl-md/commit/eeea94fe1e28028b1fd4aa4b1b4fc6a641165bcb))
* the CLI flag --flavor and the configuration key flavor, and the README for 0.3.0 (step 18d) ([33977a6](https://github.com/thoka/tbl-md/commit/33977a63fe814058760e51bc772457d9c85fa014))
* the flavors discourse and markdown-it and their markdown-it engines ([6301de9](https://github.com/thoka/tbl-md/commit/6301de92c908a79fb1fdf8e176583209cc958ba1))
* the HTML check after each conversion, and the URL decode characters of Discourse (step 18c) ([fb83e73](https://github.com/thoka/tbl-md/commit/fb83e7342b774e19baf1ded5110f07eaf5d26298))
* the link pipe rule of the flavor discourse (step 18b) ([7612970](https://github.com/thoka/tbl-md/commit/76129703ea7b04f0a68bca6d4a7d2384ec403382))
* the markdown-it plugin (step 19) ([d6203cb](https://github.com/thoka/tbl-md/commit/d6203cbae2de27be1e5c845cf689757d240184fe))
* the markdown-it plugin tbl-md/markdown-it and its single-file bundle (step 19) ([8a93ed3](https://github.com/thoka/tbl-md/commit/8a93ed3574ff07e18508e2663a0fb540c1f5899e))
* the option flavor of lint and convert ([5fcf7ec](https://github.com/thoka/tbl-md/commit/5fcf7ec825b4d1dd524c487665bc8d4956823675))
* the pipe rule and the trim of format 0.3.0 in fromGfm and toGfm ([8992fb3](https://github.com/thoka/tbl-md/commit/8992fb31736ca6e97a0529617cd7ff6fc21e9f61))

## [0.2.0](https://github.com/thoka/tbl-md/compare/v0.1.1...v0.2.0) (2026-10-06)


### ⚠ BREAKING CHANGES

* Row.id moved to row.attributes.id.
* Row.id moved to row.attributes.id. A line in the attribute form and a line `-- {...}` are no longer text, and a line `\{...}` loses one backslash.

### Features

* align and attribute errors in toGfm and fromGfm, attribute lines in locate ([bcedc5c](https://github.com/thoka/tbl-md/commit/bcedc5cea48305a365c09518755a1595e6b24d75))
* attributes in the conversion to and from GFM (step 13) ([ee5238d](https://github.com/thoka/tbl-md/commit/ee5238d0bbc1bbda17f5515e79eada9f7f33411a))
* dropAttributes and the lines of the attribute errors in convert ([205404f](https://github.com/thoka/tbl-md/commit/205404fae57c02afa1f3d1b8647b5a2eb18043b5))
* find and read the configuration file .tbl-md.json (step 14) ([b826f30](https://github.com/thoka/tbl-md/commit/b826f30ed48f92953238a51cfefb7beef18aa268))
* lint options --config and --max-warnings, and warnings in the output (step 14) ([b199dfd](https://github.com/thoka/tbl-md/commit/b199dfdc9b8914302eb724692094537a9aa33183))
* lint warns on an unknown attribute key (step 14) ([7807900](https://github.com/thoka/tbl-md/commit/7807900def3ae1b113751c0d1b1d3d2a3f3d8d92))
* lint warns on unknown attribute keys, with .tbl-md.json (step 14) ([c7c3bc0](https://github.com/thoka/tbl-md/commit/c7c3bc06ffb336c8007919dda6a328bca8446c1c))
* parse and render attributes (step 12) ([bee0eb3](https://github.com/thoka/tbl-md/commit/bee0eb3fb84a4bcbf5894d4d91e4c57d9bcab5d0))
* parse and render the attributes of columns, rows, and cells ([cf2c2e5](https://github.com/thoka/tbl-md/commit/cf2c2e595bfee0e203337c9124f18a846858d6f0))
* parse, check, and render one attribute block ([b3bc440](https://github.com/thoka/tbl-md/commit/b3bc440bb58bda3125c76a34ff34923998633664))
* the CLI option --drop-attributes for convert --to gfm ([92b80c6](https://github.com/thoka/tbl-md/commit/92b80c64aca1a70e1eb73db5d668f289043a23f7))

## [0.1.1](https://github.com/thoka/tbl-md/compare/v0.1.0...v0.1.1) (2026-10-06)


### Bug Fixes

* drop an excess GFM cell with no text in the conversion to tbl ([716e1b9](https://github.com/thoka/tbl-md/commit/716e1b935b978d6e0a98bdf9e200ad298cb9ad89))
* read the expected CLI version from package.json in the package test ([1a7b9c3](https://github.com/thoka/tbl-md/commit/1a7b9c39892a88e6d9f288b83e66041ed85b4177))
* remove the last pipe of a GFM row with spaces or tabs after it ([7e4d148](https://github.com/thoka/tbl-md/commit/7e4d148dc74f30fff75cd17cd3682a860a633520))

## 0.1.0 (2026-10-05)


### Features

* add the CLI with lint and convert ([ba36802](https://github.com/thoka/tbl-md/commit/ba3680214d0542517cb7964f7e20bf70c8e23af5))
* add the tbl parser and the shared line forms ([9cb5e71](https://github.com/thoka/tbl-md/commit/9cb5e71f47ffbcea64ee4e4b291fc4c0a7000da6))
* convert all tables of a Markdown text ([c0eb404](https://github.com/thoka/tbl-md/commit/c0eb404f171bde81b419f6c0891142f50405fda6))
* convert one table to and from GFM ([e3f891d](https://github.com/thoka/tbl-md/commit/e3f891d3f98e29764887ba49a03c89ba3b97c549))
* find tbl blocks and GFM tables, and lint them ([b875c3c](https://github.com/thoka/tbl-md/commit/b875c3c49195b243cd2a337f70bef3efc2192e28))
* locate the key lines of a tbl block ([3b891e4](https://github.com/thoka/tbl-md/commit/3b891e4e143e8069ef040f43bb8cc1b54c85e3cf))
* render a table in its canonical form ([4c0d473](https://github.com/thoka/tbl-md/commit/4c0d4732e2f67221c263eaa47e1ee8c4395b3f8c))


### Bug Fixes

* read a lone CR as a line end, as in CommonMark ([e075378](https://github.com/thoka/tbl-md/commit/e075378dd5753e5a2dd6e8b223f78c4553f896a6))
