# Python ML Service for AI-Powered Test Healing

This service replaces the TensorFlow.js implementation with a high-performance Python TensorFlow backend using FastAPI.

## 🚀 Features

- **High Performance**: Native TensorFlow Python for better performance
- **Advanced ML Capabilities**: Access to the full TensorFlow ecosystem
- **RESTful API**: Clean FastAPI interface for model management
- **Model Persistence**: Automatic model saving and loading
- **Batch Processing**: Efficient batch predictions
- **Health Monitoring**: Built-in health checks and service monitoring
- **Docker Support**: Easy deployment with Docker

## 📋 Requirements

- Python 3.8+
- TensorFlow 2.15+
- FastAPI
- 4GB+ RAM (8GB+ recommended for larger models)
- GPU support (optional, for acceleration)

## 🛠 Installation

### Option 1: Local Setup

1. **Create virtual environment:**
```bash
cd ml_service
python -m venv ml_env
source ml_env/bin/activate  # On Windows: ml_env\Scripts\activate
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Start the service:**
```bash
# Linux/Mac
./start_ml_service.sh

# Windows
start_ml_service.bat

# Or directly with uvicorn
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### Option 2: Docker Setup

1. **Build Docker image:**
```bash
docker build -t ml-service .
```

2. **Run container:**
```bash
docker run -p 8000:8000 -v $(pwd)/ml_models:/app/ml_models ml-service
```

## 🌐 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service status |
| GET | `/health` | Health check |
| GET | `/docs` | API documentation |

### Model Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/models` | Create new model |
| GET | `/models` | List all models |
| GET | `/models/{name}` | Get model info |
| DELETE | `/models/{name}` | Delete model |

### Training & Prediction

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/models/{name}/train` | Train model |
| POST | `/models/{name}/predict` | Make predictions |

### Specialized Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/models/element-detection/predict` | Element detection |
| POST | `/models/healing-success/predict` | Healing success |
| POST | `/models/strategy-effectiveness/predict` | Strategy effectiveness |

## 📊 Usage Examples

### Create a Model

```python
import requests

# Create model configuration
config = {
    "model_name": "test_model",
    "config": {
        "input_size": 25,
        "hidden_layers": [64, 32, 16],
        "output_size": 1,
        "learning_rate": 0.001,
        "epochs": 100,
        "batch_size": 32
    }
}

response = requests.post("http://localhost:8000/models", json=config)
print(response.json())
```

### Train a Model

```python
# Prepare training data
training_data = {
    "model_name": "test_model",
    "training_data": {
        "inputs": [[0.1, 0.2, 0.3, ...], [0.4, 0.5, 0.6, ...]],
        "outputs": [[1], [0]]
    }
}

response = requests.post("http://localhost:8000/models/test_model/train", json=training_data)
print(response.json())
```

### Make Predictions

```python
# Make predictions
prediction_data = {
    "model_name": "test_model",
    "inputs": [[0.1, 0.2, 0.3, ...]]
}

response = requests.post("http://localhost:8000/models/test_model/predict", json=prediction_data)
print(response.json())
```

## 🔧 Configuration

### Model Configuration

```json
{
    "input_size": 25,
    "hidden_layers": [128, 64, 32],
    "output_size": 1,
    "learning_rate": 0.001,
    "epochs": 150,
    "batch_size": 32,
    "activation": "relu",
    "output_activation": "sigmoid",
    "loss": "binary_crossentropy",
    "metrics": ["accuracy"]
}
```

### Environment Variables

```bash
# Optional configurations
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
export TF_CPP_MIN_LOG_LEVEL=2  # Reduce TensorFlow logging
export CUDA_VISIBLE_DEVICES=0  # GPU selection (if available)
```

## 🔄 Migration from TensorFlow.js

### Automatic Migration

Run the migration script to automatically migrate existing TensorFlow.js models:

```bash
cd ..
node scripts/migrate_to_python_ml.js
```

### Manual Migration Steps

1. **Start Python ML service**
2. **Update Node.js services** to use `EnhancedNeuralNetworkService`
3. **Create new models** with improved configurations
4. **Retrain models** with existing data
5. **Update imports** in your codebase

### Benefits of Migration

- ✅ **Better Performance**: 2-5x faster training and inference
- ✅ **Lower Memory Usage**: Reduced Node.js memory consumption
- ✅ **Advanced Features**: Access to latest TensorFlow capabilities
- ✅ **Better GPU Support**: Native CUDA acceleration
- ✅ **Easier Deployment**: Separate ML service scaling

## 🧪 Testing

### Health Check

```bash
curl http://localhost:8000/health
```

### Model Creation Test

```bash
curl -X POST "http://localhost:8000/models" \
-H "Content-Type: application/json" \
-d '{
    "model_name": "test_model",
    "config": {
        "input_size": 10,
        "hidden_layers": [32, 16],
        "output_size": 1
    }
}'
```

## 📈 Performance Monitoring

### Metrics Available

- Model training time
- Prediction latency
- Memory usage
- GPU utilization (if available)
- Training accuracy/loss

### Monitoring Endpoints

```bash
# Service status
curl http://localhost:8000/health

# List models with metrics
curl http://localhost:8000/models

# Individual model info
curl http://localhost:8000/models/{model_name}
```

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use:**
```bash
# Kill process using port 8000
lsof -ti:8000 | xargs kill -9
```

2. **CUDA/GPU issues:**
```bash
# Check GPU availability
python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"
```

3. **Memory issues:**
```bash
# Reduce batch size in model config
# Add memory growth for GPU
```

4. **Package conflicts:**
```bash
# Recreate virtual environment
rm -rf ml_env
python -m venv ml_env
source ml_env/bin/activate
pip install -r requirements.txt
```

### Debugging

Enable debug mode:
```bash
export FASTAPI_DEBUG=true
uvicorn app:app --host 0.0.0.0 --port 8000 --reload --log-level debug
```

### Log Files

Service logs are output to console. For production, consider:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --log-file ml_service.log
```

## 🔒 Security Considerations

- Run service on internal network only
- Use authentication for production deployments
- Validate input data thoroughly
- Monitor resource usage
- Regular security updates

## 🤝 Integration with Node.js

The Node.js application connects via `PythonMLService.js`:

```javascript
import PythonMLService from './server/services/PythonMLService.js';

const mlService = new PythonMLService('http://localhost:8000');
await mlService.initialize();

// Use enhanced neural network service
const neuralService = new EnhancedNeuralNetworkService();
await neuralService.initialize();
```

## 🚀 Production Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  ml-service:
    build: ./ml_service
    ports:
      - "8000:8000"
    volumes:
      - ./ml_models:/app/ml_models
    environment:
      - TF_CPP_MIN_LOG_LEVEL=2
    restart: unless-stopped
```

### Scaling

- Use multiple instances behind a load balancer
- Separate GPU and CPU workloads
- Implement model caching strategies
- Monitor resource usage and scale accordingly

---

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [TensorFlow Documentation](https://www.tensorflow.org/)
- [Migration Guide](../scripts/migrate_to_python_ml.js)
- [API Documentation](http://localhost:8000/docs) (when service is running)