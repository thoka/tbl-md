# Changelog

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
