# AI ML Service using FastAPI and TensorFlow Python
# Replaces TensorFlow.js implementation with better performance

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import tensorflow as tf
import numpy as np
import pickle
import json
import os
import logging
from datetime import datetime
import uvicorn
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models for API requests/responses
class TrainingData(BaseModel):
    inputs: List[List[float]]
    outputs: List[List[float]]
    validation_inputs: Optional[List[List[float]]] = None
    validation_outputs: Optional[List[List[float]]] = None

class PredictionRequest(BaseModel):
    model_name: str
    inputs: List[List[float]]

class PredictionResponse(BaseModel):
    predictions: List[List[float]]
    confidence: List[float]
    model_name: str
    timestamp: str

class ModelConfig(BaseModel):
    input_size: int
    hidden_layers: List[int] = [64, 32, 16]
    output_size: int = 1
    learning_rate: float = 0.001
    epochs: int = 100
    batch_size: int = 32
    activation: str = "relu"
    output_activation: str = "sigmoid"
    loss: str = "binary_crossentropy"
    metrics: List[str] = ["accuracy"]

class CreateModelRequest(BaseModel):
    model_name: str
    config: ModelConfig

class TrainModelRequest(BaseModel):
    model_name: str
    training_data: TrainingData
    config: Optional[ModelConfig] = None

class ModelInfo(BaseModel):
    name: str
    input_size: int
    output_size: int
    hidden_layers: List[int]
    is_trained: bool
    created_at: str
    last_trained: Optional[str] = None
    metrics: Optional[Dict[str, float]] = None

# Global variables for model management
models: Dict[str, tf.keras.Model] = {}
model_configs: Dict[str, Dict] = {}
model_metrics: Dict[str, Dict] = {}

# Model storage paths
MODELS_DIR = "ml_models"
CONFIGS_DIR = "model_configs"

def ensure_directories():
    """Ensure model storage directories exist"""
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(CONFIGS_DIR, exist_ok=True)

async def load_saved_models():
    """Load previously saved models on startup"""
    ensure_directories()
    
    try:
        # Load model configurations
        if os.path.exists(os.path.join(CONFIGS_DIR, "model_registry.json")):
            with open(os.path.join(CONFIGS_DIR, "model_registry.json"), "r") as f:
                registry = json.load(f)
                
            for model_name, config in registry.items():
                model_path = os.path.join(MODELS_DIR, f"{model_name}.h5")
                if os.path.exists(model_path):
                    try:
                        model = tf.keras.models.load_model(model_path)
                        models[model_name] = model
                        model_configs[model_name] = config
                        logger.info(f"Loaded model: {model_name}")
                    except Exception as e:
                        logger.error(f"Failed to load model {model_name}: {e}")
                        
    except Exception as e:
        logger.error(f"Failed to load saved models: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting AI ML Service...")
    await load_saved_models()
    logger.info(f"Loaded {len(models)} models")
    yield
    # Shutdown
    logger.info("Shutting down AI ML Service...")

# Initialize FastAPI app
app = FastAPI(
    title="AI ML Service",
    description="TensorFlow Python service for AI-powered test healing",
    version="1.0.0",
    lifespan=lifespan
)

def create_model(config: ModelConfig) -> tf.keras.Model:
    """Create a TensorFlow model based on configuration"""
    model = tf.keras.Sequential()
    
    # Input layer
    model.add(tf.keras.layers.Dense(
        config.hidden_layers[0],
        input_shape=(config.input_size,),
        activation=config.activation,
        kernel_initializer='glorot_uniform'
    ))
    
    # Hidden layers
    for i, units in enumerate(config.hidden_layers[1:], 1):
        model.add(tf.keras.layers.Dense(
            units,
            activation=config.activation,
            kernel_initializer='glorot_uniform'
        ))
        
        # Add dropout for regularization
        if i < len(config.hidden_layers) - 1:
            model.add(tf.keras.layers.Dropout(0.2))
    
    # Output layer
    model.add(tf.keras.layers.Dense(
        config.output_size,
        activation=config.output_activation
    ))
    
    # Compile model
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=config.learning_rate),
        loss=config.loss,
        metrics=config.metrics
    )
    
    return model

def save_model_config(model_name: str, config: Dict):
    """Save model configuration to disk"""
    ensure_directories()
    
    # Update registry
    registry_path = os.path.join(CONFIGS_DIR, "model_registry.json")
    registry = {}
    
    if os.path.exists(registry_path):
        with open(registry_path, "r") as f:
            registry = json.load(f)
    
    registry[model_name] = config
    
    with open(registry_path, "w") as f:
        json.dump(registry, f, indent=2)

@app.get("/")
async def root():
    return {"message": "AI ML Service is running", "models_loaded": len(models)}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_count": len(models),
        "tensorflow_version": tf.__version__
    }

@app.post("/models", response_model=ModelInfo)
async def create_model_endpoint(request: CreateModelRequest):
    """Create a new TensorFlow model"""
    try:
        if request.model_name in models:
            raise HTTPException(status_code=400, detail=f"Model '{request.model_name}' already exists")
        
        # Create model
        model = create_model(request.config)
        models[request.model_name] = model
        
        # Store configuration
        config_dict = {
            **request.config.model_dump(),
            "created_at": datetime.now().isoformat(),
            "is_trained": False
        }
        model_configs[request.model_name] = config_dict
        save_model_config(request.model_name, config_dict)
        
        logger.info(f"Created model: {request.model_name}")
        
        return ModelInfo(
            name=request.model_name,
            input_size=request.config.input_size,
            output_size=request.config.output_size,
            hidden_layers=request.config.hidden_layers,
            is_trained=False,
            created_at=config_dict["created_at"]
        )
        
    except Exception as e:
        logger.error(f"Failed to create model {request.model_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List all available models"""
    model_list = []
    
    for name, config in model_configs.items():
        metrics = model_metrics.get(name, {})
        model_list.append(ModelInfo(
            name=name,
            input_size=config["input_size"],
            output_size=config["output_size"],
            hidden_layers=config["hidden_layers"],
            is_trained=config.get("is_trained", False),
            created_at=config["created_at"],
            last_trained=config.get("last_trained"),
            metrics=metrics
        ))
    
    return model_list

@app.get("/models/{model_name}", response_model=ModelInfo)
async def get_model_info(model_name: str):
    """Get information about a specific model"""
    if model_name not in model_configs:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    
    config = model_configs[model_name]
    metrics = model_metrics.get(model_name, {})
    
    return ModelInfo(
        name=model_name,
        input_size=config["input_size"],
        output_size=config["output_size"],
        hidden_layers=config["hidden_layers"],
        is_trained=config.get("is_trained", False),
        created_at=config["created_at"],
        last_trained=config.get("last_trained"),
        metrics=metrics
    )

@app.post("/models/{model_name}/train")
async def train_model(model_name: str, request: TrainModelRequest):
    """Train a model with provided data"""
    try:
        if model_name not in models:
            raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
        
        model = models[model_name]
        config = model_configs[model_name]
        
        # Prepare training data
        X_train = np.array(request.training_data.inputs)
        y_train = np.array(request.training_data.outputs)
        
        validation_data = None
        if request.training_data.validation_inputs and request.training_data.validation_outputs:
            X_val = np.array(request.training_data.validation_inputs)
            y_val = np.array(request.training_data.validation_outputs)
            validation_data = (X_val, y_val)
        
        # Training configuration
        train_config = request.config.dict() if request.config else {}
        epochs = train_config.get("epochs", config.get("epochs", 100))
        batch_size = train_config.get("batch_size", config.get("batch_size", 32))
        
        logger.info(f"Training model {model_name} with {len(X_train)} samples")
        
        # Train model
        history = model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=validation_data,
            validation_split=0.2 if validation_data is None else 0.0,
            verbose=1
        )
        
        # Save model
        model_path = os.path.join(MODELS_DIR, f"{model_name}.h5")
        model.save(model_path)
        
        # Update configuration
        config["is_trained"] = True
        config["last_trained"] = datetime.now().isoformat()
        save_model_config(model_name, config)
        
        # Store metrics
        final_metrics = {
            "loss": float(history.history["loss"][-1]),
            "accuracy": float(history.history.get("accuracy", [0])[-1]),
            "val_loss": float(history.history.get("val_loss", [0])[-1]),
            "val_accuracy": float(history.history.get("val_accuracy", [0])[-1]),
            "epochs_trained": len(history.history["loss"]),
            "training_samples": len(X_train)
        }
        model_metrics[model_name] = final_metrics
        
        logger.info(f"Model {model_name} trained successfully. Final accuracy: {final_metrics['accuracy']:.4f}")
        
        return {
            "message": f"Model '{model_name}' trained successfully",
            "metrics": final_metrics,
            "history": {k: [float(v) for v in vals] for k, vals in history.history.items()}
        }
        
    except Exception as e:
        logger.error(f"Failed to train model {model_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/{model_name}/predict", response_model=PredictionResponse)
async def predict(model_name: str, request: PredictionRequest):
    """Make predictions using a trained model"""
    try:
        if model_name not in models:
            raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
        
        if not model_configs[model_name].get("is_trained", False):
            raise HTTPException(status_code=400, detail=f"Model '{model_name}' is not trained")
        
        model = models[model_name]
        
        # Prepare input data
        X = np.array(request.inputs)
        
        # Make predictions
        predictions = model.predict(X, verbose=0)
        
        # Calculate confidence scores (for binary classification)
        if model_configs[model_name]["output_size"] == 1:
            confidence = np.abs(predictions.flatten() - 0.5) * 2  # Distance from 0.5, scaled to 0-1
        else:
            confidence = np.max(predictions, axis=1)  # Max probability for multiclass
        
        return PredictionResponse(
            predictions=predictions.tolist(),
            confidence=confidence.tolist(),
            model_name=model_name,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to make prediction with model {model_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/models/{model_name}")
async def delete_model(model_name: str):
    """Delete a model"""
    try:
        if model_name not in models:
            raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
        
        # Remove from memory
        del models[model_name]
        del model_configs[model_name]
        if model_name in model_metrics:
            del model_metrics[model_name]
        
        # Remove files
        model_path = os.path.join(MODELS_DIR, f"{model_name}.h5")
        if os.path.exists(model_path):
            os.remove(model_path)
        
        # Update registry
        registry_path = os.path.join(CONFIGS_DIR, "model_registry.json")
        if os.path.exists(registry_path):
            with open(registry_path, "r") as f:
                registry = json.load(f)
            
            if model_name in registry:
                del registry[model_name]
                
            with open(registry_path, "w") as f:
                json.dump(registry, f, indent=2)
        
        logger.info(f"Deleted model: {model_name}")
        
        return {"message": f"Model '{model_name}' deleted successfully"}
        
    except Exception as e:
        logger.error(f"Failed to delete model {model_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Specialized endpoints for test automation

@app.post("/models/element-detection/predict")
async def predict_element_detection(request: PredictionRequest):
    """Specialized endpoint for element detection predictions"""
    if "element-detection" not in models:
        # Create default element detection model if it doesn't exist
        config = ModelConfig(
            input_size=25,
            hidden_layers=[64, 32, 16],
            output_size=1,
            learning_rate=0.001
        )
        model = create_model(config)
        models["element-detection"] = model
        model_configs["element-detection"] = {
            **config.model_dump(),
            "created_at": datetime.now().isoformat(),
            "is_trained": False
        }
    
    request.model_name = "element-detection"
    return await predict("element-detection", request)

@app.post("/models/healing-success/predict")
async def predict_healing_success(request: PredictionRequest):
    """Specialized endpoint for healing success predictions"""
    if "healing-success" not in models:
        config = ModelConfig(
            input_size=25,
            hidden_layers=[64, 32],
            output_size=1,
            learning_rate=0.002
        )
        model = create_model(config)
        models["healing-success"] = model
        model_configs["healing-success"] = {
            **config.model_dump(),
            "created_at": datetime.now().isoformat(),
            "is_trained": False
        }
    
    request.model_name = "healing-success"
    return await predict("healing-success", request)

@app.post("/models/strategy-effectiveness/predict")
async def predict_strategy_effectiveness(request: PredictionRequest):
    """Specialized endpoint for strategy effectiveness predictions"""
    if "strategy-effectiveness" not in models:
        config = ModelConfig(
            input_size=25,
            hidden_layers=[128, 64, 32],
            output_size=1,
            learning_rate=0.001
        )
        model = create_model(config)
        models["strategy-effectiveness"] = model
        model_configs["strategy-effectiveness"] = {
            **config.model_dump(),
            "created_at": datetime.now().isoformat(),
            "is_trained": False
        }
    
    request.model_name = "strategy-effectiveness"
    return await predict("strategy-effectiveness", request)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)