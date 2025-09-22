/**
 * Enhanced Neural Network Service
 * Now uses Python TensorFlow service instead of TensorFlow.js
 * Maintains compatibility with existing Brain.js functionality
 */

import brain from 'brain.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PythonMLService from './PythonMLService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnhancedNeuralNetworkService {
  constructor() {
    this.modelsDir = path.join(__dirname, '../data/neural-models');
    this.brainNetworks = new Map();
    this.modelConfigs = new Map();
    this.isInitialized = false;
    
    // Initialize Python ML Service
    this.pythonML = new PythonMLService();
    
    // Default configurations for Brain.js
    this.defaultBrainConfig = {
      hiddenLayers: [10, 8, 6],
      activation: 'sigmoid',
      learningRate: 0.3,
      iterations: 20000,
      errorThresh: 0.005,
      log: false,
      logPeriod: 1000,
      timeout: 300000
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      await fs.mkdir(this.modelsDir, { recursive: true });
      
      // Initialize Python ML service
      const pythonConnected = await this.pythonML.initialize();
      
      if (pythonConnected) {
        console.log('🐍 Python ML Service connected successfully');
      } else {
        console.warn('⚠️ Python ML Service not available, using fallback modes');
      }
      
      // Load existing Brain.js models
      await this.loadExistingBrainModels();
      
      this.isInitialized = true;
      console.log('🧠 Enhanced Neural Network Service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Neural Network Service:', error);
      throw error;
    }
  }

  async loadExistingBrainModels() {
    try {
      const files = await fs.readdir(this.modelsDir);
      const brainFiles = files.filter(file => file.endsWith('_brain.json'));
      
      for (const file of brainFiles) {
        const modelName = file.replace('_brain.json', '');
        await this.loadBrainModel(modelName);
      }
      
      console.log(`📋 Loaded ${brainFiles.length} Brain.js models`);
    } catch (error) {
      console.warn('⚠️ No existing Brain.js models found');
    }
  }

  // Python TensorFlow model methods
  async createTensorFlowModel(modelName, config = {}) {
    try {
      if (!await this.pythonML.isServiceHealthy()) {
        console.warn(`⚠️ Python ML Service not available, skipping create for TensorFlow model '${modelName}'`);
        // Record intended config so callers can proceed in fallback mode
        const modelConfig = {
          inputSize: config.inputSize || config.inputShape?.[0] || 25,
          hiddenLayers: this.extractHiddenLayerSizes(config.hiddenLayers) || [64, 32, 16],
          outputSize: config.outputSize || config.outputUnits || 1,
          learningRate: config.learningRate || 0.001,
          epochs: config.epochs || 100,
          batchSize: config.batchSize || 32,
          activation: config.activation || 'relu',
          outputActivation: config.outputActivation || 'sigmoid',
          loss: config.loss || 'binary_crossentropy',
          metrics: config.metrics || ['accuracy']
        };
        this.modelConfigs.set(modelName, {
          type: 'tensorflow-python',
          config: modelConfig,
          created: new Date().toISOString(),
          trained: false
        });
        return null;
      }

      const modelConfig = {
        inputSize: config.inputSize || config.inputShape?.[0] || 25,
        hiddenLayers: this.extractHiddenLayerSizes(config.hiddenLayers) || [64, 32, 16],
        outputSize: config.outputSize || config.outputUnits || 1,
        learningRate: config.learningRate || 0.001,
        epochs: config.epochs || 100,
        batchSize: config.batchSize || 32,
        activation: config.activation || 'relu',
        outputActivation: config.outputActivation || 'sigmoid',
        loss: config.loss || 'binary_crossentropy',
        metrics: config.metrics || ['accuracy']
      };

      const result = await this.pythonML.createModel(modelName, modelConfig);
      
      this.modelConfigs.set(modelName, {
        type: 'tensorflow-python',
        config: modelConfig,
        created: new Date().toISOString(),
        trained: false
      });

      console.log(`✅ Created TensorFlow model: ${modelName}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to create TensorFlow model ${modelName}:`, error.message);
      return null;
    }
  }

  async trainTensorFlowModel(modelName, trainingData, validationData = null) {
    try {
      if (!await this.pythonML.isServiceHealthy()) {
        throw new Error('Python ML Service not available');
      }

      const result = await this.pythonML.trainModel(modelName, trainingData, validationData);
      
      // Update local config
      const modelConfig = this.modelConfigs.get(modelName);
      if (modelConfig) {
        modelConfig.trained = true;
        modelConfig.lastTrained = new Date().toISOString();
        modelConfig.metrics = result.metrics;
      }

      console.log(`✅ TensorFlow model trained: ${modelName}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to train TensorFlow model ${modelName}:`, error.message);
      throw error;
    }
  }

  async predictWithTensorFlow(modelName, input) {
    try {
      if (!await this.pythonML.isServiceHealthy()) {
        throw new Error('Python ML Service not available');
      }

      const result = await this.pythonML.predict(modelName, [input]);
      return result.predictions[0];
      
    } catch (error) {
      console.error(`❌ TensorFlow prediction failed for ${modelName}:`, error.message);
      throw error;
    }
  }

  // Brain.js model methods (unchanged for compatibility)
  createBrainNetwork(modelName, architecture = null, config = {}) {
    const networkConfig = { ...this.defaultBrainConfig, ...config };
    
    let network;
    if (architecture === 'lstm' || architecture === 'rnn') {
      network = new brain.recurrent.LSTM(networkConfig);
    } else {
      network = new brain.NeuralNetwork(networkConfig);
    }
    
    this.brainNetworks.set(modelName, network);
    this.modelConfigs.set(modelName, {
      type: 'brain',
      architecture: architecture || 'feedforward',
      config: networkConfig,
      created: new Date().toISOString(),
      trained: false
    });
    
    console.log(`✅ Created Brain.js network: ${modelName}`);
    return network;
  }

  async trainBrainNetwork(modelName, trainingData, config = {}) {
    const network = this.brainNetworks.get(modelName);
    if (!network) {
      throw new Error(`Brain network '${modelName}' not found`);
    }

    const trainConfig = { ...this.defaultBrainConfig, ...config };
    
    console.log(`🏋️ Training Brain.js network: ${modelName}`);
    const stats = network.train(trainingData, trainConfig);
    
    // Update model config
    const modelConfig = this.modelConfigs.get(modelName);
    modelConfig.trained = true;
    modelConfig.lastTrained = new Date().toISOString();
    modelConfig.trainingStats = stats;
    
    console.log(`✅ Brain.js network trained: ${modelName}, Error: ${stats.error}`);
    return stats;
  }

  predictWithBrain(modelName, input) {
    const network = this.brainNetworks.get(modelName);
    if (!network) {
      throw new Error(`Brain network '${modelName}' not found`);
    }

    const modelConfig = this.modelConfigs.get(modelName);
    if (!modelConfig.trained) {
      throw new Error(`Brain network '${modelName}' is not trained`);
    }

    return network.run(input);
  }

  // Specialized prediction methods for AI features
  async predictElementSuccess(features) {
    try {
      if (await this.pythonML.isServiceHealthy()) {
        return await this.pythonML.predictElementDetection(features);
      } else {
        // Fallback to Brain.js if available
        if (this.brainNetworks.has('element_detection_brain')) {
          const result = this.predictWithBrain('element_detection_brain', features);
          return { 
            success: result.success || result || 0.5,
            confidence: 0.7,
            timestamp: new Date().toISOString()
          };
        }
        return { success: 0.5, confidence: 0.5, timestamp: new Date().toISOString() };
      }
    } catch (error) {
      console.error('❌ Element success prediction failed:', error.message);
      return { success: 0.5, confidence: 0.5, timestamp: new Date().toISOString() };
    }
  }

  async predictHealingSuccess(features) {
    try {
      if (await this.pythonML.isServiceHealthy()) {
        return await this.pythonML.predictHealingSuccess(features);
      } else {
        // Fallback logic
        return { success: 0.5, confidence: 0.5, timestamp: new Date().toISOString() };
      }
    } catch (error) {
      console.error('❌ Healing success prediction failed:', error.message);
      return { success: 0.5, confidence: 0.5, timestamp: new Date().toISOString() };
    }
  }

  async predictStrategyEffectiveness(features) {
    try {
      if (await this.pythonML.isServiceHealthy()) {
        return await this.pythonML.predictStrategyEffectiveness(features);
      } else {
        return { effectiveness: 0.5, confidence: 0.5, timestamp: new Date().toISOString() };
      }
    } catch (error) {
      console.error('❌ Strategy effectiveness prediction failed:', error.message);
      return { effectiveness: 0.5, confidence: 0.5, timestamp: new Date().toISOString() };
    }
  }

  // Model management methods
  async saveBrainModel(modelName) {
    const network = this.brainNetworks.get(modelName);
    const config = this.modelConfigs.get(modelName);
    
    if (!network || !config) {
      throw new Error(`Brain network '${modelName}' not found`);
    }

    const modelData = {
      network: network.toJSON(),
      config: config,
      timestamp: new Date().toISOString()
    };

    const filePath = path.join(this.modelsDir, `${modelName}_brain.json`);
    await fs.writeFile(filePath, JSON.stringify(modelData, null, 2));
    
    console.log(`💾 Brain.js model saved: ${filePath}`);
  }

  async loadBrainModel(modelName) {
    const filePath = path.join(this.modelsDir, `${modelName}_brain.json`);
    
    try {
      const modelData = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      const network = new brain.NeuralNetwork();
      network.fromJSON(modelData.network);
      
      this.brainNetworks.set(modelName, network);
      this.modelConfigs.set(modelName, modelData.config);
      
      console.log(`📂 Brain.js model loaded: ${modelName}`);
      return network;
    } catch (error) {
      console.log(`⚠️ Brain.js model '${modelName}' not found, will create new model when needed`);
      return null;
    }
  }

  // Utility methods
  getModel(modelName) {
    if (this.brainNetworks.has(modelName)) {
      return this.brainNetworks.get(modelName);
    }
    
    // For TensorFlow models, return config info
    if (this.modelConfigs.has(modelName) && this.modelConfigs.get(modelName).type === 'tensorflow-python') {
      return { type: 'tensorflow-python', name: modelName };
    }
    
    return null;
  }

  hasModel(modelName) {
    return this.brainNetworks.has(modelName) || this.modelConfigs.has(modelName);
  }

  getModelConfig(modelName) {
    return this.modelConfigs.get(modelName);
  }

  // Compatibility methods for TensorFlow.js-era API
  async loadTensorFlowModel(modelName) {
    try {
      if (await this.pythonML.isServiceHealthy()) {
        const info = await this.pythonML.getModelInfo(modelName);
        if (info) {
          this.modelConfigs.set(modelName, {
            type: 'tensorflow-python',
            config: info.config || {},
            created: info.created_at,
            lastTrained: info.last_trained,
            trained: !!info.is_trained,
            metrics: info.metrics
          });
          console.log(`📂 TensorFlow model '${modelName}' available in Python service`);
          return { type: 'tensorflow-python', name: modelName };
        }
        console.log(`⚠️ TensorFlow model '${modelName}' not found in Python service`);
        return null;
      }
      console.log(`⚠️ Python ML Service not available, cannot load TensorFlow model '${modelName}'`);
      return null;
    } catch (error) {
      console.log(`⚠️ TensorFlow model '${modelName}' not found, will create new model when needed`);
      return null;
    }
  }

  async saveTensorFlowModel(modelName) {
    // Models are managed remotely by the Python service; treat as no-op
    try {
      if (!(await this.pythonML.isServiceHealthy())) {
        console.log(`⚠️ Python ML Service not available, skipping save for '${modelName}'`);
        return false;
      }
      console.log(`💾 TensorFlow model '${modelName}' is managed by Python service; no local save required`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Could not confirm save for '${modelName}': ${error.message}`);
      return false;
    }
  }

  getModelInfo(modelName) {
    const config = this.modelConfigs.get(modelName);
    if (!config) return null;
    return {
      name: modelName,
      type: config.type,
      trained: config.trained,
      created: config.created,
      lastTrained: config.lastTrained,
      trainingStats: config.trainingStats,
      metrics: config.metrics
    };
  }

  getMemoryUsage() {
    return {
      brainjs_models: this.brainNetworks.size,
      total_models: this.modelConfigs.size
    };
  }

  async listModels() {
    const models = [];
    
    // Add Brain.js models
    for (const [name, config] of this.modelConfigs.entries()) {
      if (config.type === 'brain') {
        models.push({
          name,
          type: 'brain.js',
          trained: config.trained,
          created: config.created
        });
      }
    }
    
    // Add Python TensorFlow models
    if (await this.pythonML.isServiceHealthy()) {
      const pythonModels = await this.pythonML.listModels();
      for (const model of pythonModels) {
        models.push({
          name: model.name,
          type: 'tensorflow-python',
          trained: model.is_trained,
          created: model.created_at
        });
      }
    }
    
    return models;
  }

  async getServiceStatus() {
    return {
      brainjs_models: this.brainNetworks.size,
      python_service_healthy: await this.pythonML.isServiceHealthy(),
      total_models: this.modelConfigs.size,
      initialized: this.isInitialized
    };
  }

  // Migration methods
  async migrateTensorFlowJSModels() {
    console.log('🔄 Starting TensorFlow.js to Python migration...');
    
    try {
      // This would contain logic to migrate existing TensorFlow.js models
      // For now, we'll create new models with improved configurations
      
      const defaultModels = [
        {
          name: 'element_detection',
          config: {
            inputSize: 25,
            hiddenLayers: [64, 32, 16],
            outputSize: 1,
            learningRate: 0.001
          }
        },
        {
          name: 'healing_success',
          config: {
            inputSize: 25,
            hiddenLayers: [64, 32],
            outputSize: 1,
            learningRate: 0.002
          }
        },
        {
          name: 'strategy_effectiveness',
          config: {
            inputSize: 25,
            hiddenLayers: [128, 64, 32],
            outputSize: 1,
            learningRate: 0.001
          }
        }
      ];

      for (const modelDef of defaultModels) {
        try {
          await this.createTensorFlowModel(modelDef.name, modelDef.config);
          console.log(`✅ Migrated model: ${modelDef.name}`);
        } catch (error) {
          console.log(`⚠️ Model ${modelDef.name} already exists or migration failed`);
        }
      }
      
      console.log('✅ Migration completed');
      return true;
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      return false;
    }
  }

  // Cleanup methods
  async dispose() {
    this.brainNetworks.clear();
    this.modelConfigs.clear();
    this.isInitialized = false;
    console.log('🧹 Enhanced Neural Network Service disposed');
  }

  // Helper method to extract hidden layer sizes from various formats
  extractHiddenLayerSizes(hiddenLayers) {
    if (!hiddenLayers) return [64, 32, 16];
    
    if (Array.isArray(hiddenLayers)) {
      return hiddenLayers.map(layer => {
        if (typeof layer === 'number') {
          return layer;
        } else if (typeof layer === 'object' && layer.units) {
          return layer.units;
        } else {
          return 32; // Default
        }
      });
    }
    
    return [64, 32, 16]; // Default
  }
}

export default EnhancedNeuralNetworkService;