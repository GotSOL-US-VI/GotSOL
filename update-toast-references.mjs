/**
 * This script updates all toast references in the codebase to use our standardized toast utility.
 * It replaces:
 * 1. import toast from 'react-hot-toast' with import { toastUtils } from '@/utils/toast-utils'
 * 2. All calls to toast.success, toast.error, etc. with toastUtils.success, toastUtils.error, etc.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, 'src');

// Function to recursively find all files in a directory
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (stat.isFile() && 
              (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) && 
              !filePath.includes('toast-utils.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Function to update imports
function updateImports(content) {
  // Replace direct import
  let updated = content.replace(
    /import\s+toast(?:\s+as\s+[^,]+)?\s+from\s+['"]react-hot-toast['"]/g, 
    `import { toastUtils } from '@/utils/toast-utils'`
  );
  
  // Replace named import if it includes toast
  updated = updated.replace(
    /import\s+{([^}]*)toast([^}]*?)}\s+from\s+['"]react-hot-toast['"]/g, 
    (match, before, after) => {
      // Keep other named imports if they exist
      const otherImports = (before + after).replace(/,\s*,/g, ',').trim();
      
      if (otherImports && otherImports !== ',') {
        return `import { ${otherImports} } from 'react-hot-toast';\nimport { toastUtils } from '@/utils/toast-utils'`;
      } else {
        return `import { toastUtils } from '@/utils/toast-utils'`;
      }
    }
  );
  
  return updated;
}

// Function to update toast method calls
function updateToastCalls(content) {
  // Update toast.success
  let updated = content.replace(
    /toast\.success\(\s*(.*?)(?:,\s*{([^}]*?)})?\s*\)/g, 
    (match, message, options) => {
      if (options) {
        // Keep any options that aren't duration
        const filteredOptions = options
          .split(',')
          .filter(opt => !opt.trim().startsWith('duration'))
          .join(',');
        
        return filteredOptions.trim() 
          ? `toastUtils.success(${message}, {${filteredOptions}})`
          : `toastUtils.success(${message})`;
      }
      return `toastUtils.success(${message})`;
    }
  );
  
  // Update toast.error
  updated = updated.replace(
    /toast\.error\(\s*(.*?)(?:,\s*{([^}]*?)})?\s*\)/g, 
    (match, message, options) => {
      if (options) {
        // Keep any options that aren't duration
        const filteredOptions = options
          .split(',')
          .filter(opt => !opt.trim().startsWith('duration'))
          .join(',');
        
        return filteredOptions.trim() 
          ? `toastUtils.error(${message}, {${filteredOptions}})`
          : `toastUtils.error(${message})`;
      }
      return `toastUtils.error(${message})`;
    }
  );
  
  // Update toast.loading
  updated = updated.replace(
    /toast\.loading\(\s*(.*?)(?:,\s*{([^}]*?)})?\s*\)/g, 
    (match, message, options) => {
      if (options) {
        // Keep any options that aren't duration
        const filteredOptions = options
          .split(',')
          .filter(opt => !opt.trim().startsWith('duration'))
          .join(',');
        
        return filteredOptions.trim() 
          ? `toastUtils.loading(${message}, {${filteredOptions}})`
          : `toastUtils.loading(${message})`;
      }
      return `toastUtils.loading(${message})`;
    }
  );
  
  // Update toast.dismiss
  updated = updated.replace(
    /toast\.dismiss\((.*?)\)/g, 
    'toastUtils.dismiss($1)'
  );
  
  return updated;
}

// Find all TypeScript/React files
const files = findFiles(srcDir);
let updatedFilesCount = 0;

// Process each file
files.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Only process files that use toast
    if (content.includes('toast.') || content.includes('from \'react-hot-toast\'')) {
      // Apply updates
      const updatedImports = updateImports(content);
      const fullyUpdated = updateToastCalls(updatedImports);
      
      // Only write back if changes were made
      if (content !== fullyUpdated) {
        fs.writeFileSync(filePath, fullyUpdated, 'utf8');
        console.log(`Updated: ${path.relative(__dirname, filePath)}`);
        updatedFilesCount++;
      }
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
});

console.log(`\nCompleted! Updated ${updatedFilesCount} files.`); 