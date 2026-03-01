const fs = require('fs');
const path = require('path');

const professionsDir = path.join(__dirname, '../../Frontend/public/assets/icons/professions');

console.log('Cleaning up old timestamped profession icons...');

try {
  const files = fs.readdirSync(professionsDir);
  
  // Group files by base name (without timestamp)
  const fileGroups = {};
  
  files.forEach(file => {
    const match = file.match(/^(.+)-\d+\.\w+$/);
    if (match) {
      const baseName = match[1];
      const extension = path.extname(file);
      const cleanName = `${baseName}${extension}`;
      
      if (!fileGroups[baseName]) {
        fileGroups[baseName] = {
          clean: null,
          timestamped: []
        };
      }
      
      if (files.includes(cleanName)) {
        fileGroups[baseName].clean = cleanName;
      }
      fileGroups[baseName].timestamped.push(file);
    }
  });
  
  // Delete timestamped files if clean version exists
  let deletedCount = 0;
  Object.entries(fileGroups).forEach(([baseName, group]) => {
    if (group.clean) {
      group.timestamped.forEach(timestampedFile => {
        const filePath = path.join(professionsDir, timestampedFile);
        try {
          fs.unlinkSync(filePath);
          console.log(`  Deleted: ${timestampedFile}`);
          deletedCount++;
        } catch (err) {
          console.warn(`  Failed to delete ${timestampedFile}:`, err.message);
        }
      });
    }
  });
  
  console.log(`\n✅ Cleanup complete. Deleted ${deletedCount} old timestamped files.`);
  
  // List remaining files
  const remainingFiles = fs.readdirSync(professionsDir);
  console.log('\nRemaining profession icons:');
  remainingFiles.forEach(file => {
    console.log(`  - ${file}`);
  });
  
} catch (error) {
  console.error('Error during cleanup:', error);
}
