/**
 * TensorFlow Python ML Service Client
 * Replaces TensorFlow.js implementation with FastAPI backend
 */

import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PythonMLService {
  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.modelConfigs = new Map();
    this.isConnected = false;
  }

  async initialize() {
    try {
      // Test connection to Python service
      const response = await this.client.get('/health');
      this.isConnected = true;
      console.log('🐍 Connected to Python ML Service:', response.data);
      
      // Load existing models
      await this.loadExistingModels();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Python ML Service:', error.message);
      console.log('Make sure the Python ML service is running on', this.baseUrl);
      this.isConnected = false;
      return false;
    }
  }

  async loadExistingModels() {
    try {
      const response = await this.client.get('/models');
      const models = response.data;
      
      for (const model of models) {
        this.modelConfigs.set(model.name, model);
      }
      
      console.log(`📋 Loaded ${models.length} existing models`);
    } catch (error) {
      console.warn('⚠️ Failed to load existing models:', error.message);
    }
  }

  async createModel(modelName, config) {
    try {
      if (!this.isConnected) {
        throw new Error('ML Service not connected');
      }

      const modelConfig = {
        input_size: config.inputSize || config.input_size || 25,
        hidden_layers: config.hiddenLayers || config.hidden_layers || [64, 32, 16],
        output_size: config.outputSize || config.output_size || 1,
        learning_rate: config.learningRate || config.learning_rate || 0.001,
        epochs: config.epochs || 100,
        batch_size: config.batchSize || config.batch_size || 32,
        activation: config.activation || 'relu',
        output_activation: config.outputActivation || config.output_activation || 'sigmoid',
        loss: config.loss || 'binary_crossentropy',
        metrics: config.metrics || ['accuracy']
      };

      const response = await this.client.post('/models', {
        model_name: modelName,
        config: modelConfig
      });

      this.modelConfigs.set(modelName, response.data);
      console.log(`✅ Created model: ${modelName}`);
      
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const detail = typeof error.response?.data?.detail === 'string' ? error.response.data.detail : '';
      const bodyText = typeof error.response?.data === 'string' ? error.response.data : '';
      const composite = `${detail} ${bodyText} ${error.message}`.toLowerCase();
      // Treat "already exists" as success (idempotent create), even if the server mislabels status code
      if (status === 400 || status === 409 || composite.includes('already exists')) {
        console.log(`ℹ️ Model '${modelName}' already exists; returning existing model info`);
        try {
          const info = await this.getModelInfo(modelName);
          if (info) {
            this.modelConfigs.set(modelName, info);
            return info;
          }
        } catch (_) {
          // fall through to generic handling
        }
        return { name: modelName, is_trained: false };
      }
      console.error(`❌ Failed to create model ${modelName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async trainModel(modelName, trainingData, validationData = null) {
    try {
      if (!this.isConnected) {
        throw new Error('ML Service not connected');
      }

      const requestData = {
        model_name: modelName,
        training_data: {
          inputs: trainingData.inputs,
          outputs: trainingData.outputs,
          validation_inputs: validationData?.inputs || null,
          validation_outputs: validationData?.outputs || null
        }
      };

      console.log(`🏋️ Training model ${modelName} with ${trainingData.inputs.length} samples`);
      
      const response = await this.client.post(`/models/${modelName}/train`, requestData);
      
      // Update local config
      const modelInfo = this.modelConfigs.get(modelName);
      if (modelInfo) {
        modelInfo.is_trained = true;
        modelInfo.last_trained = new Date().toISOString();
        modelInfo.metrics = response.data.metrics;
      }

      console.log(`✅ Model ${modelName} trained successfully:`, response.data.metrics);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to train model ${modelName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async predict(modelName, inputs) {
    try {
      if (!this.isConnected) {
        throw new Error('ML Service not connected');
      }

      // Ensure inputs is in the correct format
      const inputArray = Array.isArray(inputs[0]) ? inputs : [inputs];

      const response = await this.client.post(`/models/${modelName}/predict`, {
        model_name: modelName,
        inputs: inputArray
      });

      return {
        predictions: response.data.predictions,
        confidence: response.data.confidence,
        modelName: response.data.model_name,
        timestamp: response.data.timestamp
      };
    } catch (error) {
      console.error(`❌ Prediction failed for model ${modelName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async predictElementDetection(features) {
    try {
      const response = await this.client.post('/models/element-detection/predict', {
        model_name: 'element_detection',
        inputs: Array.isArray(features[0]) ? features : [features]
      });

      return {
        success: response.data.predictions[0][0],
        confidence: response.data.confidence[0],
        timestamp: response.data.timestamp
      };
    } catch (error) {
      console.error('❌ Element detection prediction failed:', error.response?.data || error.message);
      return { success: 0.5, confidence: 0.5, timestamp: new Date().toISOString() };
    }
  }

  async predictHealingSuccess(features) {
    try {
      const response = await this.client.post('/models/healing-success/predict', {
        model_name: 'healing_success',
        inputs: Array.isArray(features[0]) ? features : [features]
      });

      return {
        success: response.data.predictions[0][0],
        confidence: response.data.confidence[0],
        timestamp: response.data.timestamp
      };
    } catch (error) {
      console.error('❌ Healing success prediction failed:', error.response?.data || error.message);
      return { success: 0.5, confidence: 0.5, timestamp: new Date().toISOString() };
    }
  }

  async predictStrategyEffectiveness(features) {
    try {
      const response = await this.client.post('/models/strategy-effectiveness/predict', {
        model_name: 'strategy_effectiveness',
        inputs: Array.isArray(features[0]) ? features : [features]
      });

      return {
        effectiveness: response.data.predictions[0][0],
        confidence: response.data.confidence[0],
        timestamp: response.data.timestamp
      };
    } catch (error) {
      console.error('❌ Strategy effectiveness prediction failed:', error.response?.data || error.message);
      return { effectiveness: 0.5, confidence: 0.5, timestamp: new Date().toISOString() };
    }
  }

  async getModelInfo(modelName) {
    try {
      const response = await this.client.get(`/models/${modelName}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to get model info for ${modelName}:`, error.response?.data || error.message);
      return null;
    }
  }

  async listModels() {
    try {
      const response = await this.client.get('/models');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to list models:', error.response?.data || error.message);
      return [];
    }
  }

  async deleteModel(modelName) {
    try {
      const response = await this.client.delete(`/models/${modelName}`);
      this.modelConfigs.delete(modelName);
      console.log(`🗑️ Deleted model: ${modelName}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to delete model ${modelName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Compatibility methods for existing TensorFlow.js code
  async createTensorFlowModel(modelName, config) {
    return await this.createModel(modelName, config);
  }

  async trainTensorFlowModel(modelName, trainingData, validationData) {
    return await this.trainModel(modelName, trainingData, validationData);
  }

  async predictWithTensorFlow(modelName, input) {
    const result = await this.predict(modelName, [input]);
    return result.predictions[0];
  }

  // Health check and service management
  async isServiceHealthy() {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  async getServiceInfo() {
    try {
      const response = await this.client.get('/');
      return response.data;
    } catch (error) {
      return { message: 'Service unavailable', models_loaded: 0 };
    }
  }

  // Batch operations for better performance
  async batchPredict(modelName, inputBatches) {
    try {
      const response = await this.client.post(`/models/${modelName}/predict`, {
        model_name: modelName,
        inputs: inputBatches
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Batch prediction failed for model ${modelName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async batchTrainModel(modelName, trainingBatches) {
    const results = [];
    
    for (const batch of trainingBatches) {
      try {
        const result = await this.trainModel(modelName, batch);
        results.push(result);
      } catch (error) {
        console.error(`❌ Batch training failed for ${modelName}:`, error.message);
        results.push({ error: error.message });
      }
    }
    
    return results;
  }

  // Migration utilities
  async migrateTensorFlowJSData(oldModelData) {
    try {
      // Convert TensorFlow.js model data to Python format
      const convertedData = this.convertTensorFlowJSData(oldModelData);
      
      // Create and train new model
      await this.createModel(convertedData.modelName, convertedData.config);
      
      if (convertedData.trainingData) {
        await this.trainModel(convertedData.modelName, convertedData.trainingData);
      }
      
      console.log(`✅ Migrated model: ${convertedData.modelName}`);
      return true;
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      return false;
    }
  }

  convertTensorFlowJSData(oldData) {
    // Convert TensorFlow.js format to Python format
    return {
      modelName: oldData.name || 'migrated_model',
      config: {
        input_size: oldData.inputShape?.[0] || 25,
        hidden_layers: oldData.hiddenLayers || [64, 32, 16],
        output_size: oldData.outputSize || 1,
        learning_rate: oldData.learningRate || 0.001,
        epochs: oldData.epochs || 100,
        batch_size: oldData.batchSize || 32
      },
      trainingData: oldData.trainingData ? {
        inputs: oldData.trainingData.inputs,
        outputs: oldData.trainingData.outputs
      } : null
    };
  }
}

export default PythonMLService;