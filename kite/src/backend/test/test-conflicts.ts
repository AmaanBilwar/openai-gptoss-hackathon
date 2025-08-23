// Test file with various merge conflict scenarios
import { ConflictResolver } from '../mergeConflict';
import { resolve } from 'path';
import { access } from 'fs/promises';

// Simple conflict - function definition
function calculateTotal(items: any[]) {
<<<<<<< HEAD
  return items.reduce((sum, item) => sum + item.price, 0);
=======
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total;
>>>>>>> feature-branch
}

// Conflict with base version
interface User {
  id: string;
  name: string;
||||||| base
  email: string;
  age: number;
=======
  email: string;
  isActive: boolean;
>>>>>>> feature-branch
}

// Conflict in class definition
class DataProcessor {
  private data: any[];

  constructor(data: any[]) {
    this.data = data;
  }

  process() {
<<<<<<< HEAD
    return this.data.map(item => ({
      id: item.id,
      processed: true,
      timestamp: new Date().toISOString()
    }));
=======
    const processed = [];
    for (let i = 0; i < this.data.length; i++) {
      const item = this.data[i];
      processed.push({
        id: item.id,
        processed: true,
        timestamp: new Date().toISOString(),
        index: i
      });
    }
    return processed;
>>>>>>> feature-branch
  }

  validate() {
<<<<<<< HEAD
    return this.data.every(item => item.id && item.name);
=======
    let isValid = true;
    for (const item of this.data) {
      if (!item.id || !item.name) {
        isValid = false;
        break;
      }
    }
    return isValid;
>>>>>>> feature-branch
  }
}

// Conflict in async function
async function fetchUserData(userId: string) {
<<<<<<< HEAD
  const response = await fetch(`/api/users/${userId}`);
  const user = await response.json();
  return user;
=======
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const user = await response.json();
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
>>>>>>> feature-branch
}

// Conflict in switch statement
function getStatusColor(status: string) {
  switch (status) {
    case 'active':
<<<<<<< HEAD
      return 'green';
    case 'inactive':
      return 'red';
    case 'pending':
      return 'yellow';
    default:
      return 'gray';
=======
      return '#00ff00';
    case 'inactive':
      return '#ff0000';
    case 'pending':
      return '#ffff00';
    case 'archived':
      return '#808080';
    default:
      return '#cccccc';
>>>>>>> feature-branch
  }
}

// Conflict in object literal
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
<<<<<<< HEAD
  retries: 3,
  cacheEnabled: true
=======
  retries: 5,
  cacheEnabled: false,
  debugMode: true
>>>>>>> feature-branch
};

// Conflict in array
const supportedLanguages = [
  'JavaScript',
  'TypeScript',
  'Python',
<<<<<<< HEAD
  'Java',
  'C++'
=======
  'Java',
  'C++',
  'Rust',
  'Go'
>>>>>>> feature-branch
];
