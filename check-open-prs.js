#!/usr/bin/env node

// Simple script to check for open PRs using GitHub API
const https = require('https');
const fs = require('fs');
const path = require('path');

async function getGitHubToken() {
  // Try to read token from various locations
  const tokenPaths = [
    path.join(process.env.HOME, '.gh_oauth_token'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), 'kite', '.env.local')
  ];
  
  for (const tokenPath of tokenPaths) {
    try {
      if (fs.existsSync(tokenPath)) {
        const content = fs.readFileSync(tokenPath, 'utf8');
        // Try to extract token from different formats
        if (content.includes('github_pat_') || content.includes('ghp_')) {
          const match = content.match(/(?:github_pat_|ghp_)[A-Za-z0-9_]+/);
          if (match) return match[0];
        }
        // If it's just a token file
        const trimmed = content.trim();
        if (trimmed.startsWith('github_pat_') || trimmed.startsWith('ghp_')) {
          return trimmed;
        }
      }
    } catch (err) {
      // Continue to next path
    }
  }
  
  // Check environment variables
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
}

async function getRepoInfo() {
  try {
    // Get remote origin URL
    const { execSync } = require('child_process');
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    
    // Parse GitHub repo from URL
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (err) {
    console.error('Could not determine repository info:', err.message);
  }
  return null;
}

function makeGitHubRequest(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'PR-Checker',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔍 Checking for open pull requests...\n');
  
  const token = await getGitHubToken();
  if (!token) {
    console.error('❌ No GitHub token found. Please ensure you have a token in:');
    console.error('   - ~/.gh_oauth_token');
    console.error('   - Environment variable GITHUB_TOKEN or GH_TOKEN');
    console.error('   - .env.local file');
    process.exit(1);
  }
  
  const repoInfo = await getRepoInfo();
  if (!repoInfo) {
    console.error('❌ Could not determine repository information');
    process.exit(1);
  }
  
  console.log(`📂 Repository: ${repoInfo.owner}/${repoInfo.repo}`);
  
  try {
    const response = await makeGitHubRequest(
      `/repos/${repoInfo.owner}/${repoInfo.repo}/pulls?state=open&sort=updated&direction=desc`,
      token
    );
    
    if (response.status !== 200) {
      console.error(`❌ GitHub API error: ${response.status}`);
      console.error(response.data);
      process.exit(1);
    }
    
    const openPRs = response.data;
    
    if (openPRs.length === 0) {
      console.log('✅ No open pull requests found.');
      return;
    }
    
    console.log(`\n📋 Found ${openPRs.length} open pull request(s):\n`);
    
    openPRs.forEach((pr, index) => {
      const createdDate = new Date(pr.created_at).toLocaleDateString();
      const updatedDate = new Date(pr.updated_at).toLocaleDateString();
      
      console.log(`${index + 1}. **PR #${pr.number}**: ${pr.title}`);
      console.log(`   👤 Author: ${pr.user.login}`);
      console.log(`   🌿 Branch: ${pr.head.ref} → ${pr.base.ref}`);
      console.log(`   📅 Created: ${createdDate} | Updated: ${updatedDate}`);
      console.log(`   🔗 URL: ${pr.html_url}`);
      
      if (pr.body && pr.body.trim()) {
        const shortBody = pr.body.length > 100 ? pr.body.substring(0, 100) + '...' : pr.body;
        console.log(`   📝 Description: ${shortBody.replace(/\n/g, ' ')}`);
      }
      
      console.log(`   ✅ Mergeable: ${pr.mergeable !== false ? 'Yes' : 'No'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error fetching pull requests:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
