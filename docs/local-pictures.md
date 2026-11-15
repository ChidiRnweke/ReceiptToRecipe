# Recipe pictures on your Mac

Recipe pictures come from FLUX 3 Image Klein (Black Forest Labs). In production the app calls it
through OpenRouter's images endpoint (`black-forest-labs/flux-3-image-klein`, $0.009 a 1184×880
picture). For development and for filling the shared cookbook in bulk, the same model can run on
an Apple Silicon Mac at no cost.

## Prerequisites

- An Apple Silicon Mac. The worker uses [mflux](https://github.com/filipstrand/mflux) on MLX. It
  peaks at about 6.4 GB of memory, so 16 GB of RAM is enough.
- [uv](https://docs.astral.sh/uv/). The worker declares its Python dependencies inline
  (`mflux==0.24.0`, Python 3.12), so `uv run` installs them on first use. Nothing else to install.
- About 10 GB of disk for the model. The first run downloads the 8-bit community build
  [`mflux-community/flux-3-image-klein-mflux-q8`](https://huggingface.co/mflux-community/flux-3-image-klein-mflux-q8)
  from Hugging Face into `~/.cache/huggingface`. It is not gated, so no Hugging Face login is
  needed. Set `FLUX_LOCAL_MODEL` to load another build.

## Licence

The weights are under the FLUX Kommunity License. It allows commercial use of the pictures for a
business with less than $5M annual revenue. Read the licence on the model page before you use the
pictures for anything larger.

## Use

```bash
npm run pictures:local                # every cookbook recipe without a picture
npm run pictures:local -- --limit 20  # the first 20
```

`pictures:local` is `npm run cookbook:pictures` with `IMAGE_GENERATOR=local`. It prints how long
the run will take before it starts, and it is resumable: stop it and run it again to continue.

`IMAGE_GENERATOR=local` in `.env` makes `npm run dev` use the local model too, for example for the
pictures of recipes without one that the server fills after it starts. A production server
(`NODE_ENV=production`) refuses `IMAGE_GENERATOR=local` and does not start the worker.

## Timings

Measured on an M5 Pro with 48 GB, 8-bit model, 1024×768 pictures:

- loading the model: about 6 s, once per run (the first run also downloads it);
- one picture: 25–30 s;
- 3 pictures, start to finish: 94 s; 5 pictures: 131 s.

The 8-bit pictures look the same as the OpenRouter ones.

## How it works

`LocalFluxImageGenerator` starts `uv run scripts/pictures/flux_worker.py` on the first picture
and keeps it running. The worker loads the model once and then reads one JSON request per line on
stdin and answers with one JSON line on stdout. Pictures are made one at a time. The generator
reads each PNG from a temporary folder, returns it as a `data:` URL and deletes the file. When the
worker stops or a picture takes longer than 5 minutes, that picture fails with the worker's last
log lines, and the next picture starts a new worker. The worker stops when the Node process exits.
