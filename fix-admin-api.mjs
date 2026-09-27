import fs from 'fs';

const file = 'capstone-react/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace all fetch('/api/ with fetch(getApiUrl('/api/
// But be careful to close the getApiUrl() before the fetch options {
content = content.replace(/fetch\('\/api\/([^']+)',\s*\{/g, "fetch(getApiUrl('/api/$1'), {");
content = content.replace(/fetch\(`\/api\/([^`]+)`,\s*\{/g, "fetch(getApiUrl(`/api/$1`), {");

// Handle cases without options object
content = content.replace(/fetch\('\/api\/([^']+)'\)/g, "fetch(getApiUrl('/api/$1'))");
content = content.replace(/fetch\(`\/api\/([^`]+)`\)/g, "fetch(getApiUrl(`/api/$1`))");

fs.writeFileSync(file, content);
console.log('✅ Fixed AdminDashboard.jsx');
