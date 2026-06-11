import base64
from io import BytesIO
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

app = FastAPI(title="FitJourney Food VLM Server")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model and tokenizer
model = None
tokenizer = None
device = "cpu"

def estimate_nutrition_py(name: str):
    n = name.lower()
    if 'salad' in n:            return {"calories": 120, "protein": 4,  "carbs": 10, "fats": 6}
    if 'chicken' in n:          return {"calories": 250, "protein": 27, "carbs": 0,  "fats": 12}
    if 'rice' in n:             return {"calories": 200, "protein": 4,  "carbs": 44, "fats": 1}
    if any(k in n for k in ['bread', 'toast', 'naan', 'roti', 'flatbread', 'chapatis']):
                                return {"calories": 170, "protein": 6,  "carbs": 32, "fats": 2}
    if 'egg' in n:              return {"calories": 155, "protein": 13, "carbs": 1,  "fats": 11}
    if any(k in n for k in ['burger', 'sandwich']):
                                return {"calories": 450, "protein": 22, "carbs": 40, "fats": 22}
    if 'pizza' in n:            return {"calories": 280, "protein": 11, "carbs": 36, "fats": 10}
    if any(k in n for k in ['pasta', 'noodle', 'spaghetti', 'chow mein', 'ramen']):
                                return {"calories": 220, "protein": 8,  "carbs": 43, "fats": 2}
    if 'soup' in n:             return {"calories": 100, "protein": 6,  "carbs": 12, "fats": 3}
    if any(k in n for k in ['cake', 'cookie', 'dessert', 'sweet', 'jamun', 'jalebi', 'donut']):
                                return {"calories": 350, "protein": 4,  "carbs": 55, "fats": 14}
    if any(k in n for k in ['fruit', 'apple', 'banana', 'orange', 'mango', 'grapes', 'strawberry']):
                                return {"calories": 80,  "protein": 1,  "carbs": 20, "fats": 0}
    return {"calories": 200, "protein": 8, "carbs": 25, "fats": 8}

@app.on_event("startup")
def load_vlm():
    global model, tokenizer, device
    print("Loading Moondream2 VLM model on startup...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model_id = "vikhyatk/moondream2"
    revision = "2024-08-26"
    
    torch_dtype = torch.float16 if device == "cuda" else torch.float32
    
    try:
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            trust_remote_code=True,
            revision=revision,
            torch_dtype=torch_dtype
        ).to(device)
        tokenizer = AutoTokenizer.from_pretrained(model_id, revision=revision)
        model.eval()
        print(f"Moondream2 loaded successfully on {device}!")
    except Exception as e:
        print(f"Error loading Moondream2 VLM: {e}")
        raise e

class ScanRequest(BaseModel):
    image_base64: str

@app.post("/scan")
async def scan_food(request: ScanRequest):
    global model, tokenizer, device
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="VLM Model is not initialized yet.")
        
    try:
        # Decode base64 image
        encoded_data = request.image_base64
        if "," in encoded_data:
            header, encoded_data = encoded_data.split(",", 1)
        image_bytes = base64.b64decode(encoded_data)
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        
        # Run inference
        with torch.no_grad():
            image_embeds = model.encode_image(image)
            
            # 1. Identify food name
            dish_name = model.answer_question(
                image_embeds, 
                "What is the name of the main food dish in this image? Respond with just the name of the dish.", 
                tokenizer
            ).strip()
            
            # 2. Get ingredients
            ingredients_str = model.answer_question(
                image_embeds, 
                "List the visible ingredients in this food, separated by commas.", 
                tokenizer
            ).strip()
            
            # 3. Get cuisine
            cuisine = model.answer_question(
                image_embeds, 
                "What cuisine is this food? (e.g. Indian, Chinese, Italian, Western, Mexican). Respond with one word.", 
                tokenizer
            ).strip()
            
        # Post-process
        ingredients = [i.strip() for i in ingredients_str.split(",") if i.strip()]
        nutrients = estimate_nutrition_py(dish_name)
        
        return {
            "className": dish_name,
            "confidence": 0.95,
            "nutrients": nutrients,
            "metadata": {
                "cuisine": cuisine,
                "type": "VLM Recognized",
                "ingredients": ingredients,
                "servingSuggestion": f"Enjoy this fresh {dish_name} as part of your tracking program."
            }
        }
    except Exception as e:
        print(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
