# Environment Variables

Create a `.env.local` file with these variables:

```bash
# Neon Database
NEON_DATABASE_URL="postgresql://neondb_owner:npg_lCLEu5Z2ficg@ep-morning-feather-aew5b16o-pooler.c-2.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

# PowerSync Service
POWERSYNC_SERVICE_URL=https://your-instance.powersync.com
POWERSYNC_JWT_SECRET=your-jwt-secret-key-min-32-chars

# OpenAI for Mastra
OPENAI_API_KEY=sk-your-key-here

# Optional: Override AI model
AI_MODEL=gpt-5
```

## Notes

- The Neon connection string above is for the `powerchat` project
- You need to set up a PowerSync Service instance and configure sync rules
- Generate a secure JWT secret (min 32 characters)
- Add your OpenAI API key
