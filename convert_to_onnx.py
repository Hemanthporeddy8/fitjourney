
import sys
from unittest.mock import MagicMock

# Mock modules
sys.modules["albumentations"] = MagicMock()
sys.modules["albumentations.pytorch"] = MagicMock()
sys.modules["cv2"] = MagicMock()
sys.modules["PIL"] = MagicMock()

import torch
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType
from model_definition import FitJourneyNetV2

def convert():
    checkpoint_path = "fitjourney_net_v2_best.pth"
    output_path = "public/models/fitjourney_net_v2.onnx"
    quantized_path = "public/models/fitjourney_net_v2_quant.onnx"
    
    print(f"Loading weights from {checkpoint_path}...")
    model = FitJourneyNetV2(num_kp=17)
    state_dict = torch.load(checkpoint_path, map_location=torch.device('cpu'), weights_only=True)
    model.load_state_dict(state_dict)
    model.eval()
    
    dummy_input = torch.randn(1, 3, 256, 256)
    
    print("Exporting to ONNX (Float32)...")
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Export with external_data=False to force a single file if possible
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=12,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    
    print("Applying Dynamic Quantization (to INT8)...")
    quantize_dynamic(
        output_path,
        quantized_path,
        weight_type=QuantType.QUInt8
    )
    
    print(f"Successfully exported quantized model to {quantized_path}")
    
    # Stats
    f32_size = os.path.getsize(output_path) / (1024*1024)
    q_size = os.path.getsize(quantized_path) / (1024*1024)
    print(f"Float32 Size: {f32_size:.2f} MB")
    print(f"Quantized Size: {q_size:.2f} MB")

if __name__ == "__main__":
    convert()
