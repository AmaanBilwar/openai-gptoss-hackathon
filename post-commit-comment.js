#!/usr/bin/env node

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

function makeGitHubRequest(path, method, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Commit-Comment-Bot',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function main() {
  console.log('🔍 Posting commit comment...\n');
  
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
  
  // Read the comment content
  const commentPath = path.join(__dirname, 'pr-comment.md');
  if (!fs.existsSync(commentPath)) {
    console.error('❌ Comment file not found: pr-comment.md');
    process.exit(1);
  }
  
  const commentBody = fs.readFileSync(commentPath, 'utf8');
  const commitSha = 'f78cb3a'; // The commit we want to comment on
  
  console.log(`📂 Repository: ${repoInfo.owner}/${repoInfo.repo}`);
  console.log(`📝 Commit: ${commitSha}`);
  
  try {
    const response = await makeGitHubRequest(
      `/repos/${repoInfo.owner}/${repoInfo.repo}/commits/${commitSha}/comments`,
      'POST',
      {
        body: commentBody
      },
      token
    );
    
    if (response.status === 201) {
      console.log('✅ Comment posted successfully!');
      console.log(`🔗 Comment URL: ${response.data.html_url}`);
    } else {
      console.error(`❌ GitHub API error: ${response.status}`);
      console.error(response.data);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error posting comment:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
