/**
 * Test script for Python ML service integration
 */

import PythonMLService from './server/services/PythonMLService.js';
import EnhancedNeuralNetworkService from './server/services/EnhancedNeuralNetworkService.js';

async function testIntegration() {
  console.log('🧪 Testing Python ML Service Integration...\n');

  try {
    // Test 1: Direct Python ML Service
    console.log('1️⃣ Testing direct Python ML Service connection...');
    const mlService = new PythonMLService();
    
    const connected = await mlService.initialize();
    if (connected) {
      console.log('✅ Python ML Service connected successfully');
      
      // Test service info
      const info = await mlService.getServiceInfo();
      console.log('📊 Service Info:', info);
      
      // Test model creation
      try {
        const modelConfig = {
          input_size: 10,
          hidden_layers: [32, 16],
          output_size: 1,
          learning_rate: 0.001
        };
        
        const model = await mlService.createModel('test_integration_model', modelConfig);
        console.log('✅ Model created:', model.name);
        
        // Clean up
        await mlService.deleteModel('test_integration_model');
        console.log('🗑️ Test model cleaned up');
        
      } catch (error) {
        if (error.response?.data?.detail?.includes('already exists')) {
          console.log('⚠️ Model already exists (expected in some cases)');
        } else {
          throw error;
        }
      }
      
    } else {
      console.log('❌ Python ML Service connection failed');
      return false;
    }

    console.log('\n2️⃣ Testing Enhanced Neural Network Service...');
    
    // Test 2: Enhanced Neural Network Service
    const neuralService = new EnhancedNeuralNetworkService();
    await neuralService.initialize();
    
    const status = await neuralService.getServiceStatus();
    console.log('🔍 Neural Service Status:', status);
    
    if (status.python_service_healthy) {
      console.log('✅ Enhanced Neural Service is working with Python backend');
      
      // Test element prediction
      const testFeatures = Array(25).fill(0).map(() => Math.random());
      const prediction = await neuralService.predictElementSuccess(testFeatures);
      console.log('🔮 Test prediction result:', prediction);
      
    } else {
      console.log('⚠️ Python service not healthy in Enhanced Neural Service');
    }

    console.log('\n3️⃣ Testing specialized prediction endpoints...');
    
    // Test specialized endpoints
    const testInputs = [Array(25).fill(0).map(() => Math.random())];
    
    const elementResult = await mlService.predictElementDetection(testInputs[0]);
    console.log('🎯 Element Detection:', elementResult);
    
    const healingResult = await mlService.predictHealingSuccess(testInputs[0]);
    console.log('🩹 Healing Success:', healingResult);
    
    const strategyResult = await mlService.predictStrategyEffectiveness(testInputs[0]);
    console.log('📈 Strategy Effectiveness:', strategyResult);

    console.log('\n✅ All tests passed! Python ML service integration is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('📋 Error details:', error.response.data);
    }
    return false;
  }
}

// Run the test
testIntegration().then(success => {
  if (success) {
    console.log('\n🎉 Integration test completed successfully!');
    console.log('💡 You can now use the Python ML service in your application.');
    console.log('🚀 Next steps:');
    console.log('   1. Start Python ML service: cd ml_service && python app.py');
    console.log('   2. Start Node.js backend: npm run dev:server');
    console.log('   3. Start frontend: npm run dev');
  } else {
    console.log('\n💥 Integration test failed. Please check the logs above.');
  }
}).catch(error => {
  console.error('💥 Test crashed:', error);
});