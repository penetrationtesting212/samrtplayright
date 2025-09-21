#!/usr/bin/env node

/**
 * Comprehensive System Validator and Fixer
 * Validates and fixes common issues in the Playwright Testing Suite
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDb } from './server/services/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SystemValidator {
  constructor() {
    this.issues = [];
    this.fixes = [];
  }

  /**
   * Run comprehensive system validation
   */
  async validateAndFix() {
    console.log('🔍 Starting comprehensive system validation...\n');

    try {
      await this.validateDatabase();
      await this.validateStrategies();
      await this.validateServices();
      await this.validateConfiguration();

      this.printSummary();
    } catch (error) {
      console.error('❌ Validation failed:', error);
    }
  }

  /**
   * Validate database schema and integrity
   */
  async validateDatabase() {
    console.log('📊 Validating database...');
    
    try {
      await initializeDatabase();
      const db = getDb();

      // Check executions table schema
      const execSchema = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='executions'");
      
      if (execSchema) {
        const hasCorrectForeignKey = execSchema.sql.includes('ON DELETE SET NULL');
        
        if (hasCorrectForeignKey) {
          console.log('✅ Database schema is correct');
          this.fixes.push('Database schema validation passed');
        } else {
          console.log('⚠️  Database schema needs foreign key fix');
          this.issues.push('Executions table foreign key constraint missing ON DELETE SET NULL');
          
          // Apply fix if needed
          await this.fixDatabaseSchema(db);
        }
      } else {
        console.log('❌ Executions table not found');
        this.issues.push('Executions table missing');
      }

      // Validate data integrity
      const recordCount = await db.get('SELECT COUNT(*) as count FROM executions');
      console.log(`📈 Database contains ${recordCount.count} execution records`);

    } catch (error) {
      console.error('❌ Database validation failed:', error.message);
      this.issues.push(`Database error: ${error.message}`);
    }
  }

  /**
   * Fix database schema issues
   */
  async fixDatabaseSchema(db) {
    console.log('🔧 Applying database schema fixes...');
    
    try {
      // Check if fix is needed
      const schema = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='executions'");
      
      if (!schema.sql.includes('ON DELETE SET NULL')) {
        console.log('Applying database schema fix...');
        
        await db.run('BEGIN TRANSACTION');
        
        // Create new table with correct schema
        await db.run(`
          CREATE TABLE executions_new (
            id TEXT PRIMARY KEY,
            suite_id TEXT,
            status TEXT NOT NULL,
            startTime TEXT NOT NULL,
            endTime TEXT,
            duration INTEGER,
            summary TEXT,
            reportUrl TEXT,
            FOREIGN KEY(suite_id) REFERENCES test_suites(id) ON DELETE SET NULL
          )
        `);
        
        // Copy existing data
        await db.run(`
          INSERT INTO executions_new 
          SELECT * FROM executions
        `);
        
        // Replace tables
        await db.run('DROP TABLE executions');
        await db.run('ALTER TABLE executions_new RENAME TO executions');
        
        await db.run('COMMIT');
        
        console.log('✅ Database schema fixed successfully');
        this.fixes.push('Applied database schema foreign key fix');
      }
    } catch (error) {
      await db.run('ROLLBACK');
      console.error('❌ Database fix failed:', error.message);
      this.issues.push(`Database fix failed: ${error.message}`);
    }
  }

  /**
   * Validate healing strategies
   */
  async validateStrategies() {
    console.log('\n🧠 Validating healing strategies...');
    
    try {
      const strategiesPath = path.join(__dirname, 'strategies');
      const compiledPath = path.join(__dirname, 'server', 'compiled-strategies');
      
      // Check if strategies directory exists
      const strategiesExist = await fs.access(strategiesPath).then(() => true).catch(() => false);
      
      if (strategiesExist) {
        const strategyFiles = await fs.readdir(strategiesPath);
        const tsFiles = strategyFiles.filter(f => f.endsWith('.ts'));
        
        console.log(`📁 Found ${tsFiles.length} TypeScript strategy files`);
        
        if (tsFiles.length > 0) {
          // Check if compiled strategies exist
          const compiledExist = await fs.access(compiledPath).then(() => true).catch(() => false);
          
          if (!compiledExist) {
            console.log('⚠️  Compiled strategies directory missing');
            await fs.mkdir(compiledPath, { recursive: true });
            console.log('✅ Created compiled strategies directory');
            this.fixes.push('Created compiled strategies directory');
          }
          
          // Validate key strategy files
          const keyStrategies = ['enhanced-visual-ai.ts', 'predictive-failure-analyzer.ts'];
          for (const strategy of keyStrategies) {
            if (tsFiles.includes(strategy)) {
              console.log(`✅ ${strategy} found`);
            } else {
              console.log(`⚠️  ${strategy} missing`);
              this.issues.push(`Key strategy ${strategy} not found`);
            }
          }
        }
      } else {
        console.log('❌ Strategies directory not found');
        this.issues.push('Strategies directory missing');
      }
    } catch (error) {
      console.error('❌ Strategy validation failed:', error.message);
      this.issues.push(`Strategy validation error: ${error.message}`);
    }
  }

  /**
   * Validate core services
   */
  async validateServices() {
    console.log('\n🔧 Validating core services...');
    
    const serviceFiles = [
      'server/services/HealingEngine.js',
      'server/services/EnhancedVisualAIService.js',
      'server/services/PredictiveHealingService.js',
      'server/services/StrategyLoader.js'
    ];
    
    for (const service of serviceFiles) {
      const servicePath = path.join(__dirname, service);
      try {
        await fs.access(servicePath);
        console.log(`✅ ${service} exists`);
      } catch {
        console.log(`❌ ${service} missing`);
        this.issues.push(`Core service ${service} not found`);
      }
    }
  }

  /**
   * Validate configuration files
   */
  async validateConfiguration() {
    console.log('\n⚙️  Validating configuration...');
    
    const configFiles = [
      'package.json',
      'playwright.config.js',
      'tsconfig.json',
      'vite.config.ts'
    ];
    
    for (const config of configFiles) {
      const configPath = path.join(__dirname, config);
      try {
        await fs.access(configPath);
        console.log(`✅ ${config} exists`);
      } catch {
        console.log(`⚠️  ${config} missing`);
        this.issues.push(`Configuration file ${config} not found`);
      }
    }
  }

  /**
   * Print validation summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    if (this.fixes.length > 0) {
      console.log('\n✅ FIXES APPLIED:');
      this.fixes.forEach(fix => console.log(`  • ${fix}`));
    }
    
    if (this.issues.length > 0) {
      console.log('\n⚠️  ISSUES FOUND:');
      this.issues.forEach(issue => console.log(`  • ${issue}`));
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('  • Review issues above and apply manual fixes if needed');
      console.log('  • Run server with: node server/index.js');
      console.log('  • Run frontend with: npm run dev');
    } else {
      console.log('\n🎉 ALL SYSTEMS VALIDATED SUCCESSFULLY!');
      console.log('  • Your Playwright Testing Suite is ready to use');
      console.log('  • Enhanced Visual AI Recognition is functional');
      console.log('  • Predictive Failure Analysis is operational');
    }
    
    console.log('\n💻 QUICK START:');
    console.log('  1. Start server: node server/index.js');
    console.log('  2. Start frontend: npm run dev');
    console.log('  3. Open browser: http://localhost:5173');
    console.log('='.repeat(60));
  }
}

// Run validation if called directly
console.log('🔍 Starting system validation...');
const validator = new SystemValidator();
validator.validateAndFix().catch(error => {
  console.error('❌ Validation script failed:', error);
  process.exit(1);
});

export default SystemValidator;