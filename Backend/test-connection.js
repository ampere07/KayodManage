const axios = require('axios');

const KAYOD_BACKEND_URL = 'http://localhost:8080';
const KAYOD_API_KEY = 'kayod-admin-access-key-123';

async function testConnection() {
    console.log('🔍 Testing Kayod Backend Connection...\n');
    
    // Test 1: Basic connectivity
    try {
        console.log('1️⃣ Testing basic connectivity...');
        const response = await axios.get(`${KAYOD_BACKEND_URL}/`);
        console.log('✅ Basic connectivity: PASS');
        console.log('   Response:', response.data.message);
        console.log('   Version:', response.data.version);
        console.log('   Status:', response.data.status);
    } catch (error) {
        console.error('❌ Basic connectivity: FAIL');
        console.error('   Error:', error.message);
        console.error('   This likely means the Kayod server is not running on port 8080');
        return;
    }

    // Test 2: Health endpoint
    try {
        console.log('\n2️⃣ Testing health endpoint...');
        const response = await axios.get(`${KAYOD_BACKEND_URL}/api/health`);
        console.log('✅ Health endpoint: PASS');
        console.log('   Database:', response.data.services.database);
        console.log('   API:', response.data.services.api);
    } catch (error) {
        console.error('❌ Health endpoint: FAIL');
        console.error('   Error:', error.message);
    }

    // Test 3: Admin verification endpoint without auth
    try {
        console.log('\n3️⃣ Testing verification endpoint (no auth)...');
        const response = await axios.get(`${KAYOD_BACKEND_URL}/api/credential-verification/admin/all`);
        console.log('✅ Verification endpoint (no auth): PASS - This should not happen!');
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Verification endpoint (no auth): PASS - Correctly returned 401 Unauthorized');
        } else {
            console.error('❌ Verification endpoint (no auth): UNEXPECTED ERROR');
            console.error('   Status:', error.response?.status);
            console.error('   Message:', error.response?.data?.message || error.message);
        }
    }

    // Test 4: Admin API debug endpoint
    try {
        console.log('\n4️⃣ Testing admin API debug endpoint...');
        const response = await axios.get(`${KAYOD_BACKEND_URL}/api/credential-verification/admin/debug`, {
            headers: {
                'x-api-key': KAYOD_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Admin API debug: PASS');
        console.log('   Message:', response.data.message);
        console.log('   API Key received:', response.data.apiKeyReceived);
        console.log('   Is admin API:', response.data.isAdminApi);
    } catch (error) {
        console.error('❌ Admin API debug: FAIL');
        console.error('   Status:', error.response?.status);
        console.error('   Message:', error.response?.data?.message || error.message);
    }

    // Test 5: Admin verification endpoint with auth
    try {
        console.log('\n5️⃣ Testing verification endpoint (with API key)...');
        const response = await axios.get(`${KAYOD_BACKEND_URL}/api/credential-verification/admin/all`, {
            headers: {
                'x-api-key': KAYOD_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Verification endpoint (with auth): PASS');
        console.log('   Found verifications:', response.data.data?.length || 0);
        console.log('   Total in DB:', response.data.total || 0);
        
        if (response.data.data?.length > 0) {
            console.log('   Sample verification:', {
                id: response.data.data[0]._id,
                user: response.data.data[0].userId?.name,
                status: response.data.data[0].status
            });
        }
    } catch (error) {
        console.error('❌ Verification endpoint (with auth): FAIL');
        console.error('   Status:', error.response?.status);
        console.error('   Message:', error.response?.data?.message || error.message);
        console.error('   Response data:', error.response?.data);
    }

    // Test 6: Stats endpoint
    try {
        console.log('\n6️⃣ Testing stats endpoint...');
        const response = await axios.get(`${KAYOD_BACKEND_URL}/api/credential-verification/admin/stats`, {
            headers: {
                'x-api-key': KAYOD_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Stats endpoint: PASS');
        console.log('   Stats:', response.data.data);
    } catch (error) {
        console.error('❌ Stats endpoint: FAIL');
        console.error('   Status:', error.response?.status);
        console.error('   Message:', error.response?.data?.message || error.message);
    }

    console.log('\n🎯 Test completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Ensure Kayod server is running: cd kayod/server && npm start');
    console.log('2. Check the server console for any errors');
    console.log('3. If all tests pass, the issue might be in KayodManage frontend/backend communication');
}

testConnection().catch(console.error);
