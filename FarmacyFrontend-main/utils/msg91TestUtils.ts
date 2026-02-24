// MSG91 Integration Test Utilities
// This file provides utilities to test and debug the MSG91 OTP integration

import { msg91OtpService } from '../api/msg91OtpService';
import { MSG91_CONFIG } from '../config/msg91';

export interface MSG91TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

export class MSG91TestUtils {
  /**
   * Test MSG91 configuration
   */
  static async testConfiguration(): Promise<MSG91TestResult> {
    try {
      const config = msg91OtpService.getConfig();
      
      if (!config.widgetId) {
        return {
          test: 'Configuration',
          success: false,
          message: 'Widget ID is not configured',
          data: config
        };
      }

      if (config.widgetId === 'your_widget_id_here') {
        return {
          test: 'Configuration',
          success: false,
          message: 'Widget ID is still using placeholder value',
          data: config
        };
      }

      return {
        test: 'Configuration',
        success: true,
        message: 'MSG91 configuration is valid',
        data: config
      };
    } catch (error) {
      return {
        test: 'Configuration',
        success: false,
        message: 'Failed to test configuration',
        error
      };
    }
  }

  /**
   * Test MSG91 widget initialization
   */
  static async testWidgetInitialization(): Promise<MSG91TestResult> {
    try {
      await msg91OtpService.initializeWidget();
      const config = msg91OtpService.getConfig();
      
      if (config.isInitialized) {
        return {
          test: 'Widget Initialization',
          success: true,
          message: 'MSG91 widget initialized successfully',
          data: config
        };
      } else {
        return {
          test: 'Widget Initialization',
          success: false,
          message: 'MSG91 widget failed to initialize',
          data: config
        };
      }
    } catch (error) {
      return {
        test: 'Widget Initialization',
        success: false,
        message: 'Failed to initialize MSG91 widget',
        error
      };
    }
  }

  /**
   * Test backend connectivity
   */
  static async testBackendConnectivity(): Promise<MSG91TestResult> {
    try {
      const response = await fetch(`${MSG91_CONFIG.API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        return {
          test: 'Backend Connectivity',
          success: true,
          message: 'Backend is reachable',
          data: { status: response.status }
        };
      } else {
        return {
          test: 'Backend Connectivity',
          success: false,
          message: `Backend returned status ${response.status}`,
          data: { status: response.status }
        };
      }
    } catch (error) {
      return {
        test: 'Backend Connectivity',
        success: false,
        message: 'Failed to connect to backend',
        error
      };
    }
  }

  /**
   * Run all tests
   */
  static async runAllTests(): Promise<MSG91TestResult[]> {
    const tests = [
      this.testConfiguration,
      this.testWidgetInitialization,
      this.testBackendConnectivity
    ];

    const results: MSG91TestResult[] = [];

    for (const test of tests) {
      try {
        const result = await test();
        results.push(result);
      } catch (error) {
        results.push({
          test: 'Unknown Test',
          success: false,
          message: 'Test failed with error',
          error
        });
      }
    }

    return results;
  }

  /**
   * Log test results
   */
  static logTestResults(results: MSG91TestResult[]): void {
    console.log('=== MSG91 Integration Test Results ===');
    
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.test}: ${result.message}`);
      
      if (result.data) {
        console.log('  Data:', result.data);
      }
      
      if (result.error) {
        console.log('  Error:', result.error);
      }
    });
    
    const passedTests = results.filter(r => r.success).length;
    const totalTests = results.length;
    
    console.log(`\nSummary: ${passedTests}/${totalTests} tests passed`);
    console.log('=====================================');
  }
}

// Export convenience functions
export const testMSG91Configuration = MSG91TestUtils.testConfiguration;
export const testMSG91WidgetInitialization = MSG91TestUtils.testWidgetInitialization;
export const testMSG91BackendConnectivity = MSG91TestUtils.testBackendConnectivity;
export const runMSG91Tests = MSG91TestUtils.runAllTests;
export const logMSG91TestResults = MSG91TestUtils.logTestResults; 