import Parse from 'parse';

// Your Back4App credentials
// Using environment variables with fallbacks to the current values
const PARSE_APPLICATION_ID = import.meta.env.VITE_PARSE_APP_ID || 'w0QpiVT7p7VXLlstx7EqCc7CFmLRn801rzkNjgb5';
const PARSE_JAVASCRIPT_KEY = import.meta.env.VITE_PARSE_JS_KEY || '3arYcLfhHSIhOY7j44bXK89W3hzEOwNfXStY2S4K';
const PARSE_SERVER_URL = import.meta.env.VITE_PARSE_SERVER_URL || 'https://parseapi.back4app.com';

try {
  // Initialize Parse
  Parse.initialize(PARSE_APPLICATION_ID, PARSE_JAVASCRIPT_KEY);
  Parse.serverURL = PARSE_SERVER_URL;
  console.log('Parse initialized successfully');
} catch (error) {
  console.error('Failed to initialize Parse:', error);
}

export default Parse; 