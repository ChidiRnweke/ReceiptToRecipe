# Wikibooks Cookbook fixture pages

The `.wikitext` files are the wikitext of six pages of the
[Wikibooks Cookbook](https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents), as the MediaWiki API
returned them on 15 November 2026 (`action=query&prop=revisions&rvprop=content`). `pages.json`
records each page's title, page id and revision id.

The text is by the Wikibooks contributors and is licensed
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The authors of each page are
listed in its history, e.g.
<https://en.wikibooks.org/w/index.php?title=Cookbook:20-Minute_Beef_Stroganoff&action=history>.
The files are unchanged.

| File                                   | Page                                    | Used for                              |
| -------------------------------------- | --------------------------------------- | ------------------------------------- |
| `beef-stroganoff.wikitext`             | Cookbook:20-Minute Beef Stroganoff      | a good page with a recipe summary box |
| `adobo-chicken.wikitext`               | Cookbook:Adobo Chicken (Philippine)     | a "Preparation" section and a cuisine |
| `agar-jelly.wikitext`                  | Cookbook:Agar Jelly                     | `{{convert}}` and `{{cb}}` templates  |
| `eggplant-parmesan.wikitext`           | Cookbook:Americanized Eggplant Parmesan | the procedure under a level-3 heading |
| `akamu-no-amounts.wikitext`            | Cookbook:Akamu (Nigerian Pudding)       | ingredients without amounts           |
| `afghan-bread-no-ingredients.wikitext` | Cookbook:Afghan Bread                   | an empty Ingredients section          |
