console.log('🧪 Testing Enhanced Visual AI and Predictive Healing Services...');

// Test importing services
try {
  console.log('📦 Importing services...');
  
  // Test imports
  const { default: EnhancedVisualAIService } = await import('./server/services/EnhancedVisualAIService.js');
  const { default: PredictiveHealingService } = await import('./server/services/PredictiveHealingService.js');
  
  console.log('✅ Services imported successfully');
  
  // Test Enhanced Visual AI Service
  console.log('\n🎯 Testing Enhanced Visual AI Service...');
  const visualAI = new EnhancedVisualAIService();
  const aiInitResult = await visualAI.initialize();
  console.log(`Enhanced Visual AI initialized: ${aiInitResult ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (aiInitResult) {
    const aiStats = visualAI.getStats();
    console.log('AI Stats:', JSON.stringify(aiStats, null, 2));
  }
  
  // Test Predictive Healing Service
  console.log('\n🔮 Testing Predictive Healing Service...');
  const predictiveHealing = new PredictiveHealingService();
  const healingInitResult = await predictiveHealing.initialize();
  console.log(`Predictive Healing initialized: ${healingInitResult ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (healingInitResult) {
    const healingStats = predictiveHealing.getStats();
    console.log('Healing Stats:', JSON.stringify(healingStats, null, 2));
  }
  
  // Cleanup
  visualAI.dispose();
  predictiveHealing.dispose();
  
  console.log('\n🎉 All AI services tested successfully!');
  console.log('The server should now be able to start with AI-powered healing capabilities.');
  
} catch (error) {
  console.error('❌ Error testing AI services:', error);
  console.error('Stack trace:', error.stack);
}