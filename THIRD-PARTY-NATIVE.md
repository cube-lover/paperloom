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


## Bundled OCR runtime (0.8.38, addon/models/)

| File | License | Origin |
| --- | --- | --- |
| ch_PP-OCRv4_det_infer.onnx, ch_PP-OCRv4_rec_infer.onnx, ch_ppocr_mobile_v2.0_cls_infer.onnx | Apache-2.0 | PaddleOCR PP-OCRv4/PP-OCRv2 mobile models, redistributed via the rapidocr_onnxruntime 1.4.4 wheel |
| keys.txt | Apache-2.0 | PaddleOCR ppocr/utils/ppocr_keys_v1.txt |
| ort.min.js, ort-wasm-simd.wasm | MIT | onnxruntime-web 1.14.0 dist (Microsoft) |

Redistributed unmodified; see addon/models/NOTICE.txt. Removing this folder yields a build without the bundled engine, which then uses a locally configured Python OCR worker or reports that image-text recognition is unavailable. PyMuPDF (AGPL) is still never bundled: the optional native-background high-fidelity remover remains an external, user-installed Python route.
