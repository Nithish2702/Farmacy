#!/usr/bin/env node

/**
 * Migration Script: Convert existing screens to use Global Safe Area System
 * 
 * This script helps identify and convert screens that need to be updated
 * to use the new global safe area system.
 */

const fs = require('fs');
const path = require('path');

// Directories to scan
const SCAN_DIRECTORIES = [
  'app',
  'components'
];

// File patterns to include
const INCLUDE_PATTERNS = [
  '*.tsx',
  '*.ts'
];

// Patterns to look for
const PATTERNS = {
  // SafeAreaView usage
  safeAreaView: /SafeAreaView[^}]*>/g,
  
  // ImageBackground usage
  imageBackground: /ImageBackground[^}]*>/g,
  
  // LinearGradient usage
  linearGradient: /LinearGradient[^}]*>/g,
  
  // StatusBar usage
  statusBar: /StatusBar[^}]*>/g,
  
  // SafeAreaProvider usage
  safeAreaProvider: /SafeAreaProvider[^}]*>/g,
  
  // Import statements
  imports: {
    safeAreaView: /import.*SafeAreaView.*from.*react-native-safe-area-context/,
    imageBackground: /import.*ImageBackground.*from.*react-native/,
    linearGradient: /import.*LinearGradient.*from.*expo-linear-gradient/,
    statusBar: /import.*StatusBar.*from.*react-native/,
  }
};

// Files to exclude
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'SafeAreaLayout.tsx',
  'SafeAreaContext.tsx',
  'withGlobalSafeArea.tsx',
  'useGlobalSafeArea.ts',
  '_layout.tsx'
];

function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function findFiles(dir, patterns = []) {
  const files = [];
  
  function scanDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!shouldExcludeFile(fullPath)) {
          scanDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if ((ext === '.tsx' || ext === '.ts') && !shouldExcludeFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scanDirectory(dir);
  return files;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const analysis = {
    file: filePath,
    needsMigration: false,
    patterns: {},
    suggestions: []
  };
  
  // Check for patterns
  for (const [patternName, pattern] of Object.entries(PATTERNS)) {
    if (typeof pattern === 'object' && pattern.test) {
      // For regex patterns
      const matches = content.match(pattern);
      if (matches) {
        analysis.patterns[patternName] = matches.length;
        analysis.needsMigration = true;
      }
    } else if (typeof pattern === 'object') {
      // For import patterns
      for (const [importName, importPattern] of Object.entries(pattern)) {
        if (importPattern.test(content)) {
          analysis.patterns[`import_${importName}`] = true;
          analysis.needsMigration = true;
        }
      }
    }
  }
  
  // Generate suggestions based on found patterns
  if (analysis.patterns.safeAreaView) {
    analysis.suggestions.push('Replace SafeAreaView with useGlobalSafeArea hook');
  }
  
  if (analysis.patterns.imageBackground) {
    analysis.suggestions.push('Move ImageBackground to global safe area configuration');
  }
  
  if (analysis.patterns.linearGradient) {
    analysis.suggestions.push('Move LinearGradient to global safe area configuration');
  }
  
  if (analysis.patterns.statusBar) {
    analysis.suggestions.push('Move StatusBar configuration to global safe area');
  }
  
  return analysis;
}

function generateMigrationTemplate(filePath, analysis) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const componentName = fileName.charAt(0).toUpperCase() + fileName.slice(1);
  
  return `// Migration template for ${filePath}
// Replace the existing component with this structure:

import { useGlobalSafeArea } from '@/hooks/useGlobalSafeArea';
import { useEffect } from 'react';

export default function ${componentName}() {
  const { configureSafeArea } = useGlobalSafeArea();

  useEffect(() => {
    // Configure safe area when component mounts
    configureSafeArea({
      // Add your background configuration here:
      // backgroundImage: require('@/assets/background.jpg'),
      // gradient: {
      //   colors: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)'],
      //   locations: [0, 1]
      // },
      // statusBarStyle: 'light-content',
      // edges: ['top', 'left', 'right', 'bottom']
    });

    // Cleanup when component unmounts
    return () => {
      configureSafeArea({});
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Your existing content here - remove SafeAreaView, ImageBackground, LinearGradient wrappers */}
    </View>
  );
}

// Remove these imports if they're no longer needed:
// - SafeAreaView from react-native-safe-area-context
// - ImageBackground from react-native  
// - LinearGradient from expo-linear-gradient
// - StatusBar from react-native (if only used for styling)
`;
}

function main() {
  console.log('🔍 Scanning for files that need migration to Global Safe Area System...\n');
  
  const allFiles = [];
  for (const dir of SCAN_DIRECTORIES) {
    if (fs.existsSync(dir)) {
      allFiles.push(...findFiles(dir));
    }
  }
  
  const analyses = allFiles.map(analyzeFile).filter(analysis => analysis.needsMigration);
  
  if (analyses.length === 0) {
    console.log('✅ No files found that need migration!');
    return;
  }
  
  console.log(`📋 Found ${analyses.length} files that need migration:\n`);
  
  analyses.forEach((analysis, index) => {
    console.log(`${index + 1}. ${analysis.file}`);
    console.log(`   Patterns found:`);
    
    for (const [pattern, count] of Object.entries(analysis.patterns)) {
      if (typeof count === 'number') {
        console.log(`     - ${pattern}: ${count} occurrences`);
      } else {
        console.log(`     - ${pattern}: found`);
      }
    }
    
    console.log(`   Suggestions:`);
    analysis.suggestions.forEach(suggestion => {
      console.log(`     - ${suggestion}`);
    });
    
    console.log('');
  });
  
  console.log('📝 Migration Steps:');
  console.log('1. For each file above, use the useGlobalSafeArea hook');
  console.log('2. Move background configurations to the configureSafeArea call');
  console.log('3. Remove SafeAreaView, ImageBackground, and LinearGradient wrappers');
  console.log('4. Keep only the content inside these wrappers');
  console.log('5. Always clean up with configureSafeArea({}) in useEffect cleanup');
  
  console.log('\n📚 See GLOBAL_SAFE_AREA_GUIDE.md for detailed examples and best practices');
  
  // Generate migration templates
  console.log('\n📄 Migration templates:');
  analyses.forEach((analysis, index) => {
    const template = generateMigrationTemplate(analysis.file, analysis);
    const templatePath = `migration_template_${index + 1}.txt`;
    fs.writeFileSync(templatePath, template);
    console.log(`   - ${templatePath} (for ${analysis.file})`);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeFile,
  findFiles,
  generateMigrationTemplate
}; 