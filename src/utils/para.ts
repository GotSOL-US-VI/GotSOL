import { Environment, ParaWeb } from "@getpara/react-sdk";

const apiKey = process.env.NEXT_PUBLIC_PARA_API_KEY;

// Debug API key (only show first 4 and last 4 characters for security)
console.log("Para API Key being used:", apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "Not set");

// Create a dummy Para instance for static page generation
const dummyPara = new ParaWeb(Environment.BETA, "dummy-key");

// Initialize the actual Para instance
export const para = apiKey
    ? new ParaWeb(Environment.BETA, apiKey)
    : dummyPara;

// Note: Event handling is managed through the ParaProvider component
// using the appropriate SDK methods
