---
kind: lesson
from: tbl-md
date: 2026-10-06
---

# A corpus test counts each item, and a reintroduced bug proves that it can fail.

If a corpus test checks whole files, one error in a file hides all other items of that file. Count each item (for example each table), set a failing item aside, and check the rest of the file. Then put a bug that you fixed before back for one run: the test must report it. If it does not, the comparison is too weak.

Source: tbl-md steps 10 and 10b (2026-10-06). One error at line 1325 of public-apis hid 52 tables. With the count per table, the old step 9b bug gave more than 6 differences instead of 3.
