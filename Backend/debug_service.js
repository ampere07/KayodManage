const fs = require('fs');
const path = require('path');

const servicePath1 = './app/services/verificationService.js';
const servicePath2 = '../../KayodManageRedesign/Backend/app/services/verificationService.js';

function checkFile(p) {
    try {
        if (fs.existsSync(p)) {
            console.log(`Checking ${p}:`);
            const content = fs.readFileSync(p, 'utf8');
            const lines = content.split('\n');
            for (let i = 45; i < 60; i++) {
                console.log(`Line ${i + 1}: ${lines[i]?.trim()}`);
            }
        } else {
            console.log(`${p} does not exist`);
        }
    } catch (e) {
        console.log(`Error checking ${p}: ${e.message}`);
    }
}

checkFile(servicePath1);
checkFile(servicePath2);
