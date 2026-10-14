# Native background feature: dependency and packaging notice

Cube's optional native-background worker requires a separately installed PyMuPDF runtime.
PyMuPDF is offered under AGPL and commercial licensing by its rights holders:
https://pymupdf.readthedocs.io/en/latest/about.html

No PyMuPDF library or model weights are included in this XPI. The worker source in this
repository is independently written integration code. The repository's MIT license does
not relicense PyMuPDF, and process separation alone does not determine whether a combined
distribution meets its obligations. Review the applicable license or obtain a suitable
commercial license before publicly distributing this feature as a combined product.

Development-only Node canvas dependency: @napi-rs/canvas 0.1.80 installed under
`.local/native-render-runtime`, not included in the plugin or required for users.
It is used only for offline PDF.js regression rendering.

PaddleOCR/PP-StructureV3 and LaMa are still candidates. No new models have been bundled,
downloaded or invoked as part of 0.8.14. Code and weight licenses require separate checks
when those modules are integrated.


## Bundled OCR models (0.9.0, addon/models/)

| File | License | Origin |
| --- | --- | --- |
| ch_PP-OCRv4_det_infer.onnx, ch_PP-OCRv4_rec_infer.onnx, ch_ppocr_mobile_v2.0_cls_infer.onnx | Apache-2.0 | PaddleOCR PP-OCRv4/PP-OCRv2 mobile models, redistributed via the rapidocr_onnxruntime 1.4.4 wheel |
| keys.txt | Apache-2.0 | PaddleOCR ppocr/utils/ppocr_keys_v1.txt |

Redistributed unmodified; see addon/models/NOTICE.txt. 0.9.0 removed the in-plugin inference engine (onnxruntime-web `ort.min.js` / `ort-wasm-simd.wasm`) entirely, so this folder is now the *payload* for recognition rather than a runtime: the one-click installer copies the three models into the managed runtime as `det.onnx` / `rec.onnx` / `cls.onnx` (PP-OCRv4 mobile, chosen for CPU cost; an external Python route can substitute full models by pointing the three paths elsewhere).

## Downloaded OCR runtime bundle (0.9.0, not in the repository or XPI)

`scripts/build-ocr-bundle.py` assembles `paperloom-ocr-runtime-win-x64-<version>.zip` (Python 3.12.10 embedded + 21 wheels), published on the project's GitHub Releases (`ocr-runtime-1.0.0`, sha256 `56e701d5e0dff7a600076e2112c5443a6ab3c1f2904707d0f35aa4749359ab64`, 105889554 bytes, 1297 entries). The plugin verifies that sha256 before unpacking and records it in `install.json`. Contents:

| Component | Version | License |
| --- | --- | --- |
| CPython embeddable distribution | 3.12.10 (win-amd64) | PSF-2.0 |
| rapidocr | 3.10.0 | Apache-2.0 |
| onnxruntime | 1.31.0 | MIT |
| opencv-python-headless (cv2) | 5.0.0.93 | Apache-2.0 |
| numpy | 2.5.4 | BSD-3-Clause |
| Pillow | 12.3.0 | HPND |
| shapely | 2.2.0 | BSD-3-Clause |
| pyclipper | 1.4.0 | MIT |
| PyYAML / OmegaConf / packaging / protobuf / flatbuffers / requests / urllib3 / certifi / charset-normalizer / idna / colorama / colorlog / six / tqdm / typing-extensions | see manifest.json | BSD-3-Clause / Apache-2.0 / MIT / PSF-2.0 |

The bundle's own `manifest.json` lists every wheel with its PyPI URL and sha256 (re-checked against PyPI at build time), so a rebuild can be audited file by file. PyMuPDF (AGPL) is still never bundled: the optional native-background high-fidelity remover remains an external, user-installed Python route.
