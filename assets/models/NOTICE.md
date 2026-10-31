# Crash model

`vzcrash_xgb.onnx` is an XGBoost classifier trained on the [VZCrash dataset](https://huggingface.co/datasets/vzc-research-chapter/VZCrash). Its input is the 114 features in `src/features/crash-detection/model/crashFeatures.ts`, in that exact order. Its outputs are crash, near miss, and normal.

Check the dataset's licence before shipping a product that uses this model.
