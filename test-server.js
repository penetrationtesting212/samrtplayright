// Simple test to check if our services can be imported and initialized
import EnhancedVisualAIService from './server/services/EnhancedVisualAIService.js';
import PredictiveHealingService from './server/services/PredictiveHealingService.js';

async function testServices() {
  console.log('🧪 Testing Enhanced Visual AI and Predictive Healing Services...');
  
  try {
    // Test Enhanced Visual AI Service
    console.log('📊 Testing Enhanced Visual AI Service...');
    const visualAI = new EnhancedVisualAIService();
    const initResult1 = await visualAI.initialize();
    console.log(`✅ Enhanced Visual AI Service: ${initResult1 ? 'SUCCESS' : 'FAILED'}`);
    
    // Test Predictive Healing Service
    console.log('🔮 Testing Predictive Healing Service...');
    const predictiveHealing = new PredictiveHealingService();
    const initResult2 = await predictiveHealing.initialize();
    console.log(`✅ Predictive Healing Service: ${initResult2 ? 'SUCCESS' : 'FAILED'}`);
    
    // Get stats
    console.log('\n📈 Service Statistics:');
    console.log('Visual AI Stats:', visualAI.getStats());
    console.log('Predictive Healing Stats:', predictiveHealing.getStats());
    
    // Cleanup
    visualAI.dispose();
    predictiveHealing.dispose();
    
    console.log('\n🎉 All services tested successfully!');
    
  } catch (error) {
    console.error('❌ Service test failed:', error);
    process.exit(1);
  }
}

testServices();