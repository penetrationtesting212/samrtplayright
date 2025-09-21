import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import fs from 'fs';
import path from 'path';

test.describe('Environment Validation & Dependency Check', () => {
  let environmentReport = {
    timestamp: new Date().toISOString(),
    status: 'CHECKING',
    dependencies: {},
    features: {},
    issues: [],
    recommendations: [],
    installationSteps: []
  };

  test.beforeAll(async () => {
    await allure.epic('Environment Validation');
    await allure.feature('Dependency & Setup Verification');
    console.log('🔍 Starting comprehensive environment validation...');
  });

  test('📦 Package.json Validation', async () => {
    await allure.step('Validate Package Configuration', async () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Required dependencies for the AI-powered testing suite
        const requiredDependencies = {
          // Core Testing Framework
          '@playwright/test': 'Testing framework',
          'allure-playwright': 'Test reporting',
          
          // AI & Visual Processing
          '@tensorflow/tfjs': 'AI model support',
          '@tensorflow/tfjs-node': 'Node.js TensorFlow support',
          'ssim.js': 'Visual similarity analysis',
          'jimp': 'Image processing',
          
          // Component Testing (Phase 1)
          'vitest': 'Component testing framework',
          '@testing-library/react': 'React component testing',
          '@testing-library/jest-dom': 'DOM testing utilities',
          'jsdom': 'DOM environment for testing',
          
          // Enhanced Visual AI Dependencies
          'brain.js': 'Neural network library',
          'pngjs': 'PNG image processing',
          
          // Development Dependencies
          'vite': 'Build tool',
          'eslint': 'Code linting',
          'typescript': 'TypeScript support'
        };

        const missingDependencies = [];
        const presentDependencies = [];

        for (const [dep, description] of Object.entries(requiredDependencies)) {
          const isPresent = 
            packageJson.dependencies?.[dep] || 
            packageJson.devDependencies?.[dep] || 
            packageJson.peerDependencies?.[dep];
          
          if (isPresent) {
            presentDependencies.push({ name: dep, version: isPresent, description });
            environmentReport.dependencies[dep] = { status: 'FOUND', version: isPresent };
          } else {
            missingDependencies.push({ name: dep, description });
            environmentReport.dependencies[dep] = { status: 'MISSING', description };
            environmentReport.issues.push(`Missing dependency: ${dep} (${description})`);
          }
        }

        await allure.parameter('Total Required Dependencies', Object.keys(requiredDependencies).length.toString());
        await allure.parameter('Found Dependencies', presentDependencies.length.toString());
        await allure.parameter('Missing Dependencies', missingDependencies.length.toString());

        // Add installation commands for missing dependencies
        if (missingDependencies.length > 0) {
          const installCommand = `npm install ${missingDependencies.map(d => d.name).join(' ')}`;
          environmentReport.installationSteps.push({
            step: 'Install Missing Dependencies',
            command: installCommand,
            description: 'Install required packages for AI-powered testing suite'
          });
        }

        await allure.attachment(
          'Dependency Analysis',
          JSON.stringify({
            present: presentDependencies,
            missing: missingDependencies,
            packageJsonLocation: packageJsonPath
          }, null, 2),
          'application/json'
        );

        expect(packageJson).toBeDefined();
        
      } catch (error) {
        environmentReport.issues.push(`Package.json validation failed: ${error.message}`);
        throw new Error(`Package.json validation failed: ${error.message}`);
      }
    });
  });

  test('🏗️ Project Structure Validation', async () => {
    await allure.step('Validate Project Structure', async () => {
      const requiredDirectories = [
        'src',
        'tests',
        'strategies',
        'server',
        'src/components',
        'src/ai',
        'strategies/utils',
        'src/__tests__/components',
        'src/reporting'
      ];

      const requiredFiles = [
        'playwright.config.js',
        'src/ai/visual-ai-controller.ts',
        'strategies/utils/image-processor.ts',
        'strategies/ssim-healing-strategy.ts',
        'src/reporting/ssim-test-reporter.ts',
        'src/__tests__/components/TestBuilder.test.tsx',
        'src/__tests__/components/CodegenRecorder.test.tsx',
        'src/__tests__/components/AllureReportModal.test.tsx'
      ];

      const structureReport = {
        directories: { found: [], missing: [] },
        files: { found: [], missing: [] }
      };

      // Check directories
      for (const dir of requiredDirectories) {
        const dirPath = path.join(process.cwd(), dir);
        if (fs.existsSync(dirPath)) {
          structureReport.directories.found.push(dir);
        } else {
          structureReport.directories.missing.push(dir);
          environmentReport.issues.push(`Missing directory: ${dir}`);
        }
      }

      // Check files
      for (const file of requiredFiles) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          structureReport.files.found.push(file);
        } else {
          structureReport.files.missing.push(file);
          environmentReport.issues.push(`Missing file: ${file}`);
        }
      }

      await allure.parameter('Required Directories Found', structureReport.directories.found.length.toString());
      await allure.parameter('Missing Directories', structureReport.directories.missing.length.toString());
      await allure.parameter('Required Files Found', structureReport.files.found.length.toString());
      await allure.parameter('Missing Files', structureReport.files.missing.length.toString());

      await allure.attachment(
        'Project Structure Analysis',
        JSON.stringify(structureReport, null, 2),
        'application/json'
      );

      if (structureReport.directories.missing.length > 0 || structureReport.files.missing.length > 0) {
        environmentReport.installationSteps.push({
          step: 'Create Missing Structure',
          command: 'Follow Phase 1 & Phase 2 implementation guide',
          description: 'Recreate missing directories and files from the original implementation'
        });
      }
    });
  });

  test('🎯 End-to-End Feature Testing', async ({ page }) => {
    await allure.step('Test Core Application Features', async () => {
      try {
        await page.goto('https://demo.blazemeter.com', { waitUntil: 'networkidle' });
        
        const pageTitle = await page.title();
        const hasContent = await page.locator('body').count() > 0;
        
        if (hasContent) {
          environmentReport.features.navigation = 'WORKING';
          
          const searchBox = page.locator('#searchbox, input[type="search"], .search-input');
          const searchExists = await searchBox.count() > 0;
          
          if (searchExists) {
            await searchBox.fill('Playwright Test');
            environmentReport.features.elementInteraction = 'WORKING';
          } else {
            environmentReport.features.elementInteraction = 'LIMITED';
            environmentReport.issues.push('Primary search element not found - healing strategies may be needed');
          }
          
          const screenshot = await page.screenshot({ type: 'png' });
          if (screenshot.length > 0) {
            environmentReport.features.screenshotCapture = 'WORKING';
          }
        } else {
          environmentReport.features.navigation = 'FAILED';
          environmentReport.issues.push('Cannot navigate to test website');
        }
        
        await allure.parameter('Page Navigation', environmentReport.features.navigation);
        await allure.parameter('Element Interaction', environmentReport.features.elementInteraction || 'NOT_TESTED');
        await allure.parameter('Screenshot Capture', environmentReport.features.screenshotCapture || 'NOT_TESTED');
        
      } catch (error) {
        environmentReport.issues.push(`End-to-end testing failed: ${error.message}`);
        environmentReport.features.endToEndTesting = 'FAILED';
      }
    });
  });

  test.afterAll(async () => {
    await allure.step('Generate Environment Report', async () => {
      // Determine overall status
      const criticalIssues = environmentReport.issues.filter(issue => 
        issue.includes('Package.json') || 
        issue.includes('TensorFlow') || 
        issue.includes('navigation')
      ).length;
      
      if (criticalIssues === 0 && environmentReport.issues.length === 0) {
        environmentReport.status = 'READY';
        environmentReport.recommendations.push('Environment is fully configured and ready for AI-powered testing');
      } else if (criticalIssues === 0) {
        environmentReport.status = 'PARTIALLY_READY';
        environmentReport.recommendations.push('Environment has minor issues but core functionality is available');
      } else {
        environmentReport.status = 'NEEDS_SETUP';
        environmentReport.recommendations.push('Critical dependencies missing - follow installation steps');
      }
      
      // Add setup recommendations
      environmentReport.recommendations.push('Run npm install to ensure all dependencies are installed');
      environmentReport.recommendations.push('Execute Phase 1 & Phase 2 implementation if files are missing');
      
      // Generate comprehensive HTML report
      const htmlReport = generateHTMLReport(environmentReport);
      
      // Save HTML report
      const reportPath = path.join(process.cwd(), 'environment-validation-report.html');
      fs.writeFileSync(reportPath, htmlReport);
      
      await allure.attachment('Environment Validation Report', htmlReport, 'text/html');
      await allure.attachment('Environment Data', JSON.stringify(environmentReport, null, 2), 'application/json');
      
      await allure.parameter('Overall Status', environmentReport.status);
      await allure.parameter('Total Issues Found', environmentReport.issues.length.toString());
      
      console.log(`📋 Environment validation complete. Report saved to: ${reportPath}`);
      console.log(`📊 Status: ${environmentReport.status}`);
    });
  });
});

function generateHTMLReport(report) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Environment Validation Report</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin-top: 15px; }
        .status-ready { background: #4CAF50; color: white; }
        .status-needs-setup { background: #F44336; color: white; }
        .content { padding: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 10px 0; }
        .status-found { color: #28a745; font-weight: bold; }
        .status-missing { color: #dc3545; font-weight: bold; }
        .installation-step { background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .installation-step code { background: #263238; color: #B0BEC5; padding: 8px 12px; border-radius: 4px; display: block; margin: 8px 0; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Environment Validation Report</h1>
            <div>Generated: ${report.timestamp}</div>
            <div class="status-badge status-${report.status.toLowerCase().replace('_', '-')}">
                Status: ${report.status.replace('_', ' ')}
            </div>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>📦 Dependencies Status</h2>
                ${Object.entries(report.dependencies).map(([name, info]) => `
                    <div class="card">
                        <strong>${name}</strong>
                        <span class="status-${info.status.toLowerCase()}">${info.status}</span>
                        ${info.description ? `<br><small>${info.description}</small>` : ''}
                    </div>
                `).join('')}
            </div>

            ${report.issues.length > 0 ? `
            <div class="section">
                <h2>⚠️ Issues Found</h2>
                <ul>${report.issues.map(issue => `<li>${issue}</li>`).join('')}</ul>
            </div>
            ` : ''}

            ${report.installationSteps.length > 0 ? `
            <div class="section">
                <h2>🔧 Installation Steps</h2>
                ${report.installationSteps.map(step => `
                    <div class="installation-step">
                        <h4>${step.step}</h4>
                        <p>${step.description}</p>
                        <code>${step.command}</code>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <div class="section">
                <h2>💡 Recommendations</h2>
                <ul>${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}</ul>
            </div>
        </div>
    </div>
</body>
</html>`;
}