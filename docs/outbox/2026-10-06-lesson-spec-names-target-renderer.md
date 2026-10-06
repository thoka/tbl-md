---
kind: lesson
from: tbl-md
date: 2026-10-06
---

# A spec names the renderer of the target platform as the reference of its tests.

tbl-md chose micromark and mdast as its only parser, and its corpus test measured "renders the same" with the mdast of micromark. The user wanted Discourse from the beginning, but the spec did not name it, and Discourse renders with markdown-it. After 15 steps and the release 0.2.0, the pipe rules, the excess-cell rule, and the corpus test rested on measurements of the wrong renderer.

At the start of a project that converts or renders a format, ask which platforms must show the result, and write them into the goal of the spec. Make the renderer of the main platform, with its own settings, the reference of the tests.

Source: tbl-md, grilling interview on the Discourse plugin, 2026-10-06, docs/PLAN.md steps 16 and later.
