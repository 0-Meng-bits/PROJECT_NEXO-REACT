// Script to update all /api/ fetch calls to use getApiUrl helper
import fs from 'fs';
import path from 'path';

const filesToUpdate = [
  'capstone-react/src/components/Auth.jsx',
  'capstone-react/src/components/AdminDashboard.jsx',
  'capstone-react/src/components/Onboarding.jsx',
  'capstone-react/src/components/ProfileShop.jsx',
  'capstone-react/src/components/UserPortal.jsx',
];

filesToUpdate.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add import if not present
  if (!content.includes("import { getApiUrl } from")) {
    // Find the last import statement
    const importRegex = /import .+ from .+;/g;
    const imports = content.match(importRegex);
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      content = content.replace(lastImport, `${lastImport}\nimport { getApiUrl } from '../lib/api';`);
    }
  }
  
  // Replace all fetch('/api/... patterns
  content = content.replace(/fetch\(`\/api\//g, "fetch(getApiUrl(`/api/");
  content = content.replace(/fetch\('\/api\//g, "fetch(getApiUrl('/api/");
  content = content.replace(/fetch\("\/api\//g, 'fetch(getApiUrl("/api/');
  
  // Handle template literals with variables
  content = content.replace(/fetch\(\`\/api\/([^`]+)\`/g, 'fetch(getApiUrl(`/api/$1`)');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated: ${filePath}`);
});

console.log('✨ All files updated!');
