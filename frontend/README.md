# My App

A simple web application built with Next.js, Convex, and Clerk authentication.

## Features

- 🔐 **GitHub Authentication** - Sign in with your GitHub account
- 🗄️ **Convex Backend** - Real-time database with automatic sync
- ⚡ **Next.js Frontend** - Fast, modern React framework
- 🎨 **Tailwind CSS** - Beautiful, responsive design

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Convex (real-time database)
- **Authentication**: Clerk
- **Language**: TypeScript

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file with:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_CONVEX_URL=your_convex_url
   ```

3. **Configure Clerk**:
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Create a new application
   - Add GitHub as an OAuth provider
   - Copy your publishable key and secret key

4. **Configure Convex**:
   - Run `npx convex dev` to start the development server
   - Follow the prompts to create a new Convex project
   - Copy your Convex URL

5. **Start the development server**:
   ```bash
   npm run dev
   ```

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx          # Main application page
│   └── layout.tsx        # Root layout
├── components/
│   └── ConvexClientProvider.tsx  # Convex client setup
├── convex/
│   ├── myFunctions.ts    # Convex backend functions
│   ├── schema.ts         # Database schema
│   └── auth.config.ts    # Authentication configuration
└── middleware.ts         # Clerk middleware
```

## Database Schema

The application uses a simple schema with a `users` table to store user profiles:

```typescript
users: {
  userId: string,      // Clerk user ID
  name: string,        // User's full name
  email: string,       // User's email
  avatar?: string,     // User's avatar URL
}
```

## Authentication Flow

1. User clicks "Sign in with GitHub"
2. Clerk handles OAuth flow with GitHub
3. User is redirected back to the app
4. User profile is automatically synced to Convex database
5. User sees their profile information

## Development

- **Frontend**: Edit `app/page.tsx` to modify the UI
- **Backend**: Edit `convex/myFunctions.ts` to add new functions
- **Database**: Edit `convex/schema.ts` to modify the schema

## Deployment

1. Deploy to Vercel: `vercel --prod`
2. Set up environment variables in your deployment platform
3. Configure Clerk and Convex for production

## Next Steps

This is a clean foundation. You can now:
- Add more database tables and functions
- Create additional pages and components
- Implement real-time features
- Add more authentication providers
- Build your specific application features
