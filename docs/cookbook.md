# The shared cookbook

The shared cookbook is the [Wikibooks Cookbook](https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents)
(text under CC BY-SA 4.0), structured into recipes, embedded for search, and given pictures made
with FLUX 3 Image Klein. Making it is preprocessing, done once on a workstation. A server only
loads the result, a **cookbook bundle**, and calls no model to do so.

## Load a bundle

```bash
npm run cookbook:load -- https://github.com/ChidiRnweke/ReceiptToRecipe/releases/download/cookbook-<date>/cookbook-bundle-<date>.tar.gz
# or a file on disk
npm run cookbook:load -- artifacts/cookbook-bundle-<date>.tar.gz
```

The loader uses the app's `DATABASE_URL` and object store (`MINIO_*`). It writes each recipe
with its embedding into `cookbook_recipes` and stores its picture through the storage service,
like a generated picture. Loading is idempotent: a page already stored at the bundle's revision,
with a picture, is left alone, so loading the same bundle twice changes nothing and a newer bundle
updates only the pages whose revision changed. A bundle whose catalog does not match the checksum
in its manifest is refused. Recipes added later still get their pictures from OpenRouter as usual.

Bundles are published as GitHub pre-releases tagged `cookbook-<date>`. The tag does not start with
`v`, so release-please and the deploy workflow ignore it.

## What a bundle holds

A `.tar.gz` with:

- `catalog.jsonl`: one recipe per line, with its page id, revision, title, page URL, licence,
  structured recipe, tags, cuisine, item keys, which structurer made it, its embedding
  (`openai/text-embedding-3-small` at 768 dimensions, the same model the app's search queries
  use) and its picture file and credit.
- `pictures/<pageId>.webp`: the picture, at most 800 px wide.
- `manifest.json`: the format version, counts of recipes, pictures and embeddings, the models
  used, the licences (CC BY-SA 4.0 for the text, the FLUX Kommunity License for the pictures)
  and the SHA-256 of `catalog.jsonl`.

## Make a bundle

The preprocessing scripts are the only code that reads the `PREPROCESS_*` settings. Each model
may run on any OpenAI-compatible server, on this machine or hosted. Unset, the scripts use
OpenRouter with the app's models.

| Setting                           | Used by                     | Default                                        |
| --------------------------------- | --------------------------- | ---------------------------------------------- |
| `PREPROCESS_LLM_BASE_URL`         | `cookbook:import`, captions | `https://openrouter.ai/api/v1`                 |
| `PREPROCESS_LLM_MODEL`            | `cookbook:import`           | `OPENROUTER_MODEL`                             |
| `PREPROCESS_LLM_API_KEY`          | `cookbook:import`           | `OPENROUTER_API_KEY` for OpenRouter, else none |
| `PREPROCESS_LLM_REASONING_EFFORT` | `cookbook:import`           | not sent (`none` stops a thinking model)       |
| `PREPROCESS_IMAGE_BASE_URL`       | `cookbook:pictures`         | OpenRouter                                     |
| `PREPROCESS_IMAGE_MODEL`          | `cookbook:pictures`         | `OPENROUTER_IMAGE_MODEL`, else FLUX 3 Klein    |
| `PREPROCESS_IMAGE_API_KEY`        | `cookbook:pictures`         | none for another server                        |

The text server must serve `POST /chat/completions`. The structurer asks for a JSON object and
asks again without that setting if the server refuses it. The image server must serve
`POST /images/generations` with `{ model, prompt, size: "1K", aspect_ratio: "4:3" }` and answer
`{ data: [{ b64_json }] }` or `{ data: [{ url }] }`. Embeddings always go through OpenRouter
(`OPENROUTER_API_KEY`), so the catalog matches production search.

The run happens in three steps, and each one can be stopped and started again:

1. **Embed every page fast.** Run `IMPORTER_STRUCTURER=rules npm run cookbook:import -- --no-pictures`.
   It reads the wiki at about one request per second, caches responses under
   `artifacts/cache/wikibooks/`, structures the pages by rules and embeds them. This takes about
   half an hour.
2. **Structure with the model.** Run `npm run cookbook:import -- --no-pictures` with the
   `PREPROCESS_LLM_*` settings. A model run structures again every page the rules structured. If
   an embedding call fails, the page keeps the embedding it already has, so the catalog stays
   searchable even if the OpenRouter key stops working midway. Interrupted, the run continues
   where it stopped, because pages the model already structured are skipped.
3. **Make pictures.** Run `npm run cookbook:pictures -- --yes` with the `PREPROCESS_IMAGE_*`
   settings. Each picture is drawn from a scene caption of the served dish (what the camera sees
   on the plate, never a list of ingredients) plus the house style. The caption is kept in the
   recipe as `pictureCaption`; a recipe without one is captioned first on the `PREPROCESS_LLM_*`
   text server (`OPENROUTER_CAPTION_MODEL`, else `google/gemini-3.1-flash-lite`, when the model
   is unset). Only recipes without a picture are picked up, so the run is resumable. To make a
   picture again, clear its `image_url` and run the step again. After the house style changes
   (`HOUSE_PICTURE_STYLE_VERSION`), `npm run cookbook:pictures -- --regenerate --yes` makes every
   older picture again; each new picture records its style as `pictureStyle`, so a stopped run
   continues where it ended. A recipe with `pictureAttempt` set is drawn again with a new seed.

Then write the bundle:

```bash
PREPROCESS_LLM_MODEL=<text model> PREPROCESS_IMAGE_MODEL=<image model> \
  npm run cookbook:export -- --out artifacts/cookbook-bundle-<date>.tar.gz
```
